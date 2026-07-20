-- Wishlist "new owner" alerts.
-- Run once in the Supabase SQL editor; safe to re-run.
--
-- When a collector marks a bobblehead owned, everyone who has that same
-- bobblehead on their wishlist (user_wants.wanted) gets a one-off email with a
-- link to it — the seed of a trade connection. The client can't do this itself:
-- RLS makes user_wants private per-user, so no signed-in account can see who
-- else wants a listing. So the whole thing runs database-side in a SECURITY
-- DEFINER trigger, matching notify-new-submission (supabase/webhook_trigger.sql)
-- rather than adding a service-role key the app deliberately doesn't hold.
--
-- Privacy: the email never names the new owner (owning is private data, and
-- sharing here is opt-in everywhere else too). It just says a wishlist item now
-- has an owner and links to it.
--
-- Volume: at most one email per (wanter, bobblehead) ever — the first time any
-- owner appears. wishlist_alerts_sent below is that ledger. Toggling owned off
-- and on again, or a second owner turning up, sends nothing further.

-- ---------------------------------------------------------------------------
-- Preference (on by default) + dedupe ledger
-- ---------------------------------------------------------------------------

-- Opt-out lives on profiles alongside is_public. Default true: these are
-- low-volume, only-about-your-own-wishlist emails, so on-by-default is the
-- engaging choice and Settings offers the switch.
alter table public.profiles
  add column if not exists email_wishlist_alerts boolean not null default true;

-- One row per alert already sent. The primary key is the dedupe: a wanter is
-- told about a given bobblehead at most once. No RLS policies at all (default
-- deny) — only the SECURITY DEFINER trigger below reads or writes it.
create table if not exists public.wishlist_alerts_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  bobblehead_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, bobblehead_id)
);

alter table public.wishlist_alerts_sent enable row level security;

-- ---------------------------------------------------------------------------
-- Preference setter
-- ---------------------------------------------------------------------------
-- profiles has no client update policy (see schema.sql — letting the client
-- write it directly would let it pick its own slug), so the toggle goes through
-- a SECURITY DEFINER RPC, same shape as enable_public_shelf().
create or replace function public.set_wishlist_alerts(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Defensive insert: the sync_profile_from_auth trigger makes this row at
  -- signup, but re-create it if it's somehow missing rather than silently
  -- no-op'ing the user's choice.
  insert into public.profiles (id, email_wishlist_alerts)
  values (auth.uid(), coalesce(p_enabled, true))
  on conflict (id) do update
    set email_wishlist_alerts = coalesce(p_enabled, true),
        updated_at = now();
end;
$$;

revoke all on function public.set_wishlist_alerts(boolean) from public, anon;
grant execute on function public.set_wishlist_alerts(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- The trigger
-- ---------------------------------------------------------------------------
-- pg_net is enabled by default on Supabase; kept here so this file stands alone.
create extension if not exists pg_net with schema extensions;

-- Replace <WEBHOOK_SECRET> below with the real value before running -- it must
-- match `supabase secrets set WEBHOOK_SECRET=...` (shared with the other
-- functions). Do not commit the filled-in version of this file.
create or replace function public.notify_wishlist_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipients jsonb;
  v_url text;
begin
  -- Fire only when a listing becomes owned: an insert with owned = true, or an
  -- update that flips owned false -> true. Toggling back off, or a no-op
  -- re-save, notifies no one.
  if tg_op = 'UPDATE' and coalesce(old.owned, false) then
    return new;
  end if;

  -- Everyone who wants this exact bobblehead, other than the new owner, who
  -- hasn't opted out and hasn't already been told. The dedupe rows are inserted
  -- in the same statement and we email only the rows we actually claimed, so two
  -- near-simultaneous owners can't both notify the same wanter.
  with eligible as (
    select w.user_id, au.email
    from public.user_wants w
    join auth.users au on au.id = w.user_id
    left join public.profiles p on p.id = w.user_id
    where w.bobblehead_id = new.bobblehead_id
      and w.wanted = true
      and w.user_id <> new.user_id
      and au.email is not null
      and coalesce(p.email_wishlist_alerts, true) = true
      and not exists (
        select 1 from public.wishlist_alerts_sent s
        where s.user_id = w.user_id
          and s.bobblehead_id = new.bobblehead_id
      )
  ),
  claimed as (
    insert into public.wishlist_alerts_sent (user_id, bobblehead_id)
    select user_id, new.bobblehead_id from eligible
    on conflict (user_id, bobblehead_id) do nothing
    returning user_id
  )
  select jsonb_agg(e.email)
    into v_recipients
    from eligible e
    join claimed c on c.user_id = e.user_id;

  if v_recipients is null or jsonb_array_length(v_recipients) = 0 then
    return new;
  end if;

  -- Community ids are slug-safe (see approve_submission) and route to the
  -- community page; everything else is a curated listing. Mirrors the href split
  -- used throughout the app (lib/profile.ts).
  v_url := 'https://bobbleshelf.com/teams/' || new.team_slug ||
    case
      when new.bobblehead_id like 'community-%'
        then '/community?id=' || new.bobblehead_id
      else '/bobbleheads/' || new.bobblehead_id
    end;

  perform net.http_post(
    url := 'https://mawwzvnlihhsagatmolq.supabase.co/functions/v1/notify-wishlist-owner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '<WEBHOOK_SECRET>'
    ),
    body := jsonb_build_object(
      'recipients', v_recipients,
      'url', v_url
    )
  );

  return new;
end;
$$;

-- WHEN keeps the function from even being called for the common "unmark owned"
-- and favorite/wanted writes on other tables; the body handles the false->true
-- vs already-true distinction for updates.
drop trigger if exists on_collection_owned on public.user_collections;
create trigger on_collection_owned
  after insert or update on public.user_collections
  for each row
  when (new.owned = true)
  execute function public.notify_wishlist_owner();
