-- Email notification preferences.
-- Run once in the Supabase SQL editor after wishlist_alerts.sql; safe to re-run.
--
-- Adds a master "email me nothing" switch plus per-type opt-outs, and one
-- helper — wants_email() — that every automated sender checks. Putting the
-- decision in a single function is the point: the senders are database triggers
-- scattered across wishlist_alerts.sql, webhook_trigger.sql and
-- team_rep_welcome.sql, and each one deciding for itself is how a preference
-- quietly stops being honored on one path.
--
-- AFTER RUNNING THIS, re-run these three files so their trigger functions pick
-- up the wants_email() check:
--   supabase/wishlist_alerts.sql
--   supabase/webhook_trigger.sql
--   supabase/team_rep_welcome.sql
--
-- Scope: these preferences govern *automated* notifications. A one-off email an
-- admin composes and sends to a specific person from the admin console
-- (admin-send-email) is direct correspondence, not a notification, and is
-- deliberately not gated — an operator replying to someone must not be silently
-- swallowed by an unsubscribe flag.

-- ---------------------------------------------------------------------------
-- Preference columns
-- ---------------------------------------------------------------------------
-- All default true, matching email_wishlist_alerts from wishlist_alerts.sql:
-- every one of these is low-volume and about the recipient's own activity, so
-- on-by-default is the right call and Settings carries the switches.

-- Repeated from wishlist_alerts.sql so this file stands alone: wants_email()
-- below is `language sql`, so its body is parsed when it's created, and a
-- missing column would fail the CREATE rather than the first call.
alter table public.profiles
  add column if not exists email_wishlist_alerts boolean not null default true;

-- The master switch. False means send this account nothing automated at all.
alter table public.profiles
  add column if not exists email_enabled boolean not null default true;

-- "Your submission was approved / was not approved" (webhook_trigger.sql).
alter table public.profiles
  add column if not exists email_submission_updates boolean not null default true;

-- The daily digest of what team reps changed (rep_activity.sql). Only ever sent
-- to admins, so Settings only shows this switch to an admin.
alter table public.profiles
  add column if not exists email_rep_digest boolean not null default true;

-- ---------------------------------------------------------------------------
-- The one check every sender makes
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the calling trigger can ask about *another* user's
-- preference — the wishlist alert decides on behalf of every wanter, and RLS
-- would otherwise hide those rows.
--
-- Returns true for a user with no profile row: the row is created at signup by
-- sync_profile_from_auth, and a missing one means "we have no opt-out on
-- record", not "opted out". Same reasoning as the coalesce(...) defaults that
-- were already in the wishlist trigger.
-- NOTE: supabase/notification_emails_off.sql recreates this function with the
-- site-wide pause check added. Re-running THIS file drops that check and every
-- notification email starts flowing again, silently — run
-- notification_emails_off.sql afterwards.
create or replace function public.wants_email(p_user_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user_id is null then false
    else coalesce(
      (
        select p.email_enabled
           and case p_kind
                 when 'all' then true
                 when 'wanted_alerts' then p.email_wishlist_alerts
                 when 'submission_updates' then p.email_submission_updates
                 when 'rep_digest' then p.email_rep_digest
                 -- An unknown kind is a bug in the caller. Fail closed rather
                 -- than mailing on a preference nobody can turn off.
                 else false
               end
        from public.profiles p
        where p.id = p_user_id
      ),
      -- No profile row: honor the master default (on) for known kinds only.
      p_kind in ('all', 'wanted_alerts', 'submission_updates', 'rep_digest')
    )
  end;
$$;

revoke all on function public.wants_email(uuid, text) from public, anon;
grant execute on function public.wants_email(uuid, text) to authenticated;

-- Same question, asked by email address. The team-rep welcome is triggered off
-- team_reps, which is keyed by email and may name someone who hasn't signed up
-- yet — in which case there's no preference to honor and the mail should go.
-- NOTE: supabase/notification_emails_off.sql recreates this function with the
-- site-wide pause check added. Re-running THIS file drops that check and every
-- notification email starts flowing again, silently — run
-- notification_emails_off.sql afterwards.
create or replace function public.wants_email_by_address(p_email text, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select public.wants_email(u.id, p_kind)
      from auth.users u
      where lower(u.email) = lower(p_email)
      limit 1
    ),
    true
  );
$$;

revoke all on function public.wants_email_by_address(text, text) from public, anon;
grant execute on function public.wants_email_by_address(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Preference setter
-- ---------------------------------------------------------------------------
-- profiles has no client update policy (see schema.sql — letting the client
-- write it directly would let it pick its own slug), so writes go through a
-- SECURITY DEFINER RPC. One RPC covering every switch rather than one per
-- column, so adding a preference later doesn't mean adding a function and a
-- grant to go with it.
--
-- set_wishlist_alerts(boolean) from wishlist_alerts.sql still works and still
-- writes the same column; this supersedes it for new callers.
create or replace function public.set_email_preference(p_kind text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean := coalesce(p_enabled, true);
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_kind is null or p_kind not in ('all', 'wanted_alerts', 'submission_updates', 'rep_digest') then
    raise exception 'unknown email preference: %', p_kind;
  end if;

  -- Defensive insert: sync_profile_from_auth makes this row at signup, but
  -- re-create it if it's somehow missing rather than silently dropping the
  -- user's choice. Every other column has a default.
  insert into public.profiles (id) values (auth.uid())
  on conflict (id) do nothing;

  update public.profiles set
    email_enabled =
      case when p_kind = 'all' then v_enabled else email_enabled end,
    email_wishlist_alerts =
      case when p_kind = 'wanted_alerts' then v_enabled else email_wishlist_alerts end,
    email_submission_updates =
      case when p_kind = 'submission_updates' then v_enabled else email_submission_updates end,
    email_rep_digest =
      case when p_kind = 'rep_digest' then v_enabled else email_rep_digest end,
    updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.set_email_preference(text, boolean) from public, anon;
grant execute on function public.set_email_preference(text, boolean) to authenticated;
