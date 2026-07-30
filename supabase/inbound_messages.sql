-- Messages the public sends in: contact-form messages and team-rep applications.
-- Run once in the Supabase SQL editor after email_preferences.sql; safe to re-run.
--
-- Two features, one table, discriminated by `kind`. They are the same shape (who
-- you are, how to reach you, what you want) and the same lifecycle (arrives,
-- admin reads it, admin marks it handled), so splitting them into two tables
-- would mean two sets of policies, two rate limits and two admin views to keep
-- in step. `team_slug` is the only kind-specific column.
--
-- Why a table at all, rather than just emailing: an email that bounces or lands
-- in spam is gone. The row is the record — the contact form and the rep
-- application both replace things that used to be "email the owner directly,"
-- and losing one silently is worse than the mailto it replaced.
--
-- This also takes the owner's personal address off the site: /contact posts here
-- instead of publishing a mailto: link.

-- ---------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------
create table if not exists public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact', 'rep_application')),
  name text,
  -- Free text, not a reference to auth.users: the whole point is that someone
  -- who isn't signed in (or signed up) can reach the owner.
  email text not null,
  -- Which team a rep application is for. Null for contact messages. Free text
  -- for the same reason team_reps.team_slug is: teams live in lib/teams.ts.
  team_slug text,
  message text not null,
  -- Set when the sender happened to be signed in, purely so the admin can see
  -- that context. Never trusted as identity.
  submitted_by uuid references auth.users (id) on delete set null,
  status text not null default 'new' check (status in ('new', 'handled')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null
);

create index if not exists inbound_messages_created_at_idx
  on public.inbound_messages (created_at desc);

alter table public.inbound_messages enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
-- Anyone may write, nobody but an admin may read. A sender can't read back even
-- their own row: there is no "my messages" view in the product, and allowing
-- selects by email would turn the table into an oracle for whether an address
-- has ever written in.
drop policy if exists "inbound_messages: public insert" on public.inbound_messages;
create policy "inbound_messages: public insert"
  on public.inbound_messages for insert
  to anon, authenticated
  with check (
    -- Shape checks, enforced server-side so a hand-rolled request can't bypass
    -- the form's own validation. Length caps keep a single insert from being a
    -- payload dump.
    email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    and length(email) <= 200
    and length(message) between 10 and 4000
    and (name is null or length(name) <= 120)
    and (team_slug is null or length(team_slug) <= 60)
    -- A rep application must name a team; a contact message must not.
    and (kind <> 'rep_application' or team_slug is not null)
    and (kind <> 'contact' or team_slug is null)
    -- Can't arrive pre-handled, and can't forge someone else's id.
    and status = 'new'
    and handled_at is null
    and handled_by is null
    and (submitted_by is null or submitted_by = auth.uid())
  );

drop policy if exists "inbound_messages: admin select" on public.inbound_messages;
create policy "inbound_messages: admin select"
  on public.inbound_messages for select
  using (public.is_admin());

drop policy if exists "inbound_messages: admin update" on public.inbound_messages;
create policy "inbound_messages: admin update"
  on public.inbound_messages for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Rate limit
-- ---------------------------------------------------------------------------
-- Same shape as enforce_submission_rate_limit (supabase/rate_limit.sql) and the
-- same SQLSTATE, so lib/rateLimit.ts already recognizes the refusal. Throttled
-- per email address rather than per user id, because this path is open to anon.
--
-- An email address is trivially varied, so this is a politeness limit, not a
-- defense — it stops a stuck submit button and casual flooding. The real backstop
-- is that nothing here is published: unread rows cost only storage.
create or replace function public.enforce_inbound_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_hour int;
  v_last_day int;
begin
  select count(*) into v_last_hour
  from public.inbound_messages
  where lower(email) = lower(new.email)
    and created_at > now() - interval '1 hour';

  select count(*) into v_last_day
  from public.inbound_messages
  where lower(email) = lower(new.email)
    and created_at > now() - interval '24 hours';

  if v_last_hour >= 3 or v_last_day >= 10 then
    raise exception 'You''ve sent a few messages already. Please wait a bit and try again.'
      using errcode = 'BB429';
  end if;

  return new;
end;
$$;

drop trigger if exists rate_limit_inbound_messages on public.inbound_messages;
create trigger rate_limit_inbound_messages
  before insert on public.inbound_messages
  for each row
  execute function public.enforce_inbound_message_rate_limit();

-- ---------------------------------------------------------------------------
-- Admin views
-- ---------------------------------------------------------------------------
-- The admin console reads through an RPC rather than selecting the table, to
-- match admin_list_team_reps and friends.
create or replace function public.admin_list_inbound_messages(p_kind text default null)
returns setof public.inbound_messages
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.inbound_messages
  where public.is_admin()
    and (p_kind is null or kind = p_kind)
  order by
    -- Unhandled first, then newest, so the queue reads as a queue.
    case when status = 'new' then 0 else 1 end,
    created_at desc;
$$;

revoke all on function public.admin_list_inbound_messages(text) from public, anon;
grant execute on function public.admin_list_inbound_messages(text) to authenticated;

create or replace function public.admin_mark_message_handled(p_id uuid, p_handled boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.inbound_messages set
    status = case when p_handled then 'handled' else 'new' end,
    handled_at = case when p_handled then now() else null end,
    handled_by = case when p_handled then auth.uid() else null end
  where id = p_id;
end;
$$;

revoke all on function public.admin_mark_message_handled(uuid, boolean) from public, anon;
grant execute on function public.admin_mark_message_handled(uuid, boolean) to authenticated;

-- Marking handled keeps the record; this throws it away. Both exist because the
-- queue collects two different things: a real message that's been answered is
-- worth keeping, and spam or a test submission is only noise. There is no delete
-- policy on the table to match -- like the two functions above, this is the only
-- way in, so an admin can't delete by selecting the table directly.
create or replace function public.admin_delete_inbound_message(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.inbound_messages where id = p_id;

  -- The caller just clicked a row it had on screen, so a miss means someone
  -- else deleted it first. Say so rather than reporting a silent success.
  if not found then
    raise exception 'message not found';
  end if;
end;
$$;

revoke all on function public.admin_delete_inbound_message(uuid) from public, anon;
grant execute on function public.admin_delete_inbound_message(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Notify the admin
-- ---------------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;

-- The x-webhook-secret header reads from Vault via public.webhook_secret()
-- rather than carrying a literal. Run webhook_secret.sql once before this
-- file; there is nothing to substitute here any more. See that file for why:
-- the hand-substitution this replaces is what left every mailer silently broken.

create or replace function public.notify_inbound_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipients jsonb;
begin
  -- Every admin who hasn't switched automated mail off. Unlike the other
  -- notifiers this resolves the address list from public.admins rather than
  -- hardcoding it, so the owner's address isn't baked into the function.
  select jsonb_agg(u.email)
  into v_recipients
  from public.admins ad
  join auth.users u on lower(u.email) = lower(ad.email)
  where public.wants_email(u.id, 'all');

  if v_recipients is null or jsonb_array_length(v_recipients) = 0 then
    return new;
  end if;

  perform net.http_post(
    url := 'https://mawwzvnlihhsagatmolq.supabase.co/functions/v1/notify-inbound-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', public.webhook_secret()
    ),
    body := jsonb_build_object(
      'recipients', v_recipients,
      'kind', new.kind,
      'name', new.name,
      'email', new.email,
      'team_slug', new.team_slug,
      'message', new.message
    )
  );

  return new;
end;
$$;

drop trigger if exists on_inbound_message_created on public.inbound_messages;
create trigger on_inbound_message_created
  after insert on public.inbound_messages
  for each row
  execute function public.notify_inbound_message();
