-- The site-wide notification email switch — currently OFF.
-- Run once in the Supabase SQL editor (or via the CLI); safe to re-run.
--
-- Decision (2026-08-18): the site sends no automated notification email at all.
-- The only mail a member ever gets is the Supabase Auth confirm-signup message
-- when they join, plus password reset — both account mail, neither of them a
-- notification, and neither touched by this file.
--
-- WHAT THIS SWITCHES OFF (all ten automated senders):
--   trigger  notify_new_submission        admin: "a submission needs review"
--   trigger  notify_new_report            admin: "a listing was reported"
--   trigger  notify_submission_reviewed   submitter: approved / not approved
--   trigger  notify_conversation_message  "you have a new message"
--   trigger  notify_inbound_message       admins: contact-form mail
--   trigger  notify_wishlist_owner        wanted-list alerts
--   trigger  notify_new_team_rep          team-rep welcome
--   cron     send_weekly_digest           weekly roundup
--   cron     send_rep_activity_digest     daily rep summary
--   cron     send_forum_digest            morning Team Rep Forum digest
--
-- WHAT IT DELIBERATELY LEAVES ALONE:
--   * Supabase Auth mail — confirm-signup and reset-password (supabase/email-templates).
--   * admin-send-email — a one-off an admin composes to a specific person. That
--     is direct correspondence, not a notification; the same reasoning that kept
--     it outside the per-user opt-outs keeps it outside this switch.
--   * notify_revalidate — a webhook, not mail.
--
-- Nothing is deleted. The triggers, the cron jobs and the per-user preference
-- switches all stay exactly as they were, and stop at one boolean. To bring
-- every notification back exactly as it was:
--
--   select public.set_notification_emails(true);
--
-- THE ONE WAY TO BREAK THIS: four function bodies below are recreated by other
-- files in this directory. Re-running any of these drops the guard and email
-- starts flowing again with no warning —
--   wants_email:            email_preferences.sql, messages.sql,
--                           weekly_digest.sql, mod_forum.sql
--   wants_email_by_address: email_preferences.sql
--   notify_new_submission,
--   notify_new_report:      webhook_trigger.sql
-- If you run one of those, run this file again after it. Each of them now
-- carries a pointer back here saying so.

-- ---------------------------------------------------------------------------
-- The switch
-- ---------------------------------------------------------------------------
-- One row, forced by the check constraint on a boolean primary key: there is a
-- single site-wide answer, and no way to end up with two rows disagreeing.
create table if not exists public.notification_emails (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Seeded off. `do nothing` on conflict so re-running this file never silently
-- flips the switch back — once the row exists, set_notification_emails owns it.
insert into public.notification_emails (id, enabled)
values (true, false)
on conflict (id) do nothing;

-- Readable by anyone, writable by nobody directly: the Settings page reads it
-- through the function below to tell members their switches are paused, and the
-- only writer is the SECURITY DEFINER setter.
alter table public.notification_emails enable row level security;

drop policy if exists "notification_emails: world readable" on public.notification_emails;
create policy "notification_emails: world readable"
  on public.notification_emails for select
  using (true);

grant select on public.notification_emails to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The reader every sender consults
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER and STABLE to match wants_email, which calls it: the senders
-- are triggers running as whoever happened to write the row, and this must
-- answer the same way for all of them.
--
-- Coalesces to true on a missing row so a half-applied install can't be the
-- thing that silences the site. Off has to be a decision someone recorded, not
-- an accident.
create or replace function public.notification_emails_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.notification_emails where id), true);
$$;

grant execute on function public.notification_emails_enabled() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The setter
-- ---------------------------------------------------------------------------
create or replace function public.set_notification_emails(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;

  insert into public.notification_emails (id, enabled, updated_at)
  values (true, coalesce(p_enabled, false), now())
  on conflict (id) do update
    set enabled = excluded.enabled, updated_at = now();

  return coalesce(p_enabled, false);
end;
$$;

revoke all on function public.set_notification_emails(boolean) from public, anon;
grant execute on function public.set_notification_emails(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Guard 1: wants_email — seven of the ten senders ask it first
-- ---------------------------------------------------------------------------
-- Body copied from the live definition (pg_get_functiondef, 2026-08-18) with a
-- single leading branch added, rather than from any one .sql file here: the
-- three later files that recreate this function each hold a different subset of
-- the preference kinds, and rebuilding it from the wrong one would quietly drop
-- the messages / weekly_digest / forum_digest switches.
create or replace function public.wants_email(p_user_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- Site-wide pause. Checked before anything else so no per-user preference
    -- can talk its way past it.
    when not public.notification_emails_enabled() then false
    when p_user_id is null then false
    else coalesce(
      (
        select p.email_enabled
           and case p_kind
                 when 'all' then true
                 when 'wanted_alerts' then p.email_wishlist_alerts
                 when 'submission_updates' then p.email_submission_updates
                 when 'rep_digest' then p.email_rep_digest
                 when 'weekly_digest' then p.email_weekly_digest
                 when 'forum_digest' then p.email_forum_digest
                 when 'messages' then p.email_messages
                 -- An unknown kind is a bug in the caller. Fail closed rather
                 -- than mailing on a preference nobody can turn off.
                 else false
               end
        from public.profiles p
        where p.id = p_user_id
      ),
      -- No profile row: honor the master default (on) for known kinds only.
      p_kind in ('all', 'wanted_alerts', 'submission_updates', 'rep_digest',
                 'weekly_digest', 'forum_digest', 'messages')
    )
  end;
$$;

revoke all on function public.wants_email(uuid, text) from public, anon;
grant execute on function public.wants_email(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Guard 2: wants_email_by_address — the team-rep welcome
-- ---------------------------------------------------------------------------
-- Needs its own guard rather than inheriting one: it coalesces an unknown
-- address to true on purpose (a rep named in team_reps who hasn't signed up has
-- no preference to honor), so it never reaches wants_email in exactly the case
-- that would otherwise still send.
create or replace function public.wants_email_by_address(p_email text, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.notification_emails_enabled() then false
    else coalesce(
      (
        select public.wants_email(u.id, p_kind)
        from auth.users u
        where lower(u.email) = lower(p_email)
        limit 1
      ),
      true
    )
  end;
$$;

revoke all on function public.wants_email_by_address(text, text) from public, anon;
grant execute on function public.wants_email_by_address(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Guard 3 and 4: the two admin notifiers, which never asked wants_email
-- ---------------------------------------------------------------------------
-- These mail the admins about someone else's row, so there was no user whose
-- preference to consult. Both bodies are the live ones with the pause check
-- added as the first condition — first specifically so that a paused site does
-- not burn the throttle slot (claim_notification_slot writes as it tests), which
-- would otherwise swallow the first real nudge for 15 minutes after the switch
-- is turned back on.

create or replace function public.notify_new_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only notify the admin about submissions that actually need review. A team
  -- rep or admin submitting for a team they manage auto-approves instantly (see
  -- maybeAutoApprove in lib/submissions.ts), so it never enters the queue —
  -- emailing "pending review" for it is just noise. can_edit_team() runs against
  -- the submitter's session here, so it's the same rights check that gates the
  -- auto-approve.
  --
  -- claim_notification_slot (supabase/notification_throttle.sql) caps the email
  -- to one per cooldown window: a burst of submissions sends a single nudge and
  -- the review queue carries the rest. Order matters — the site-wide pause and
  -- can_edit_team both come first, so neither a paused site nor an auto-approved
  -- rep submission silently consumes the slot.
  if public.notification_emails_enabled()
     and not public.can_edit_team(new.team_slug)
     and public.claim_notification_slot('submission_review', interval '15 minutes') then
    perform net.http_post(
      url := 'https://mawwzvnlihhsagatmolq.supabase.co/functions/v1/notify-new-submission',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', public.webhook_secret()
      ),
      body := jsonb_build_object('type', 'INSERT', 'table', 'submissions', 'record', row_to_json(new))
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_new_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Same cooldown as notify_new_submission above, on its own slot so a report
  -- and a submission arriving together each still get their one nudge.
  if public.notification_emails_enabled()
     and public.claim_notification_slot('listing_report', interval '15 minutes') then
    perform net.http_post(
      url := 'https://mawwzvnlihhsagatmolq.supabase.co/functions/v1/notify-new-submission',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', public.webhook_secret()
      ),
      body := jsonb_build_object('type', 'INSERT', 'table', 'listing_reports', 'record', row_to_json(new))
    );
  end if;
  return new;
end;
$$;

-- The triggers themselves are untouched — the functions above replace in place
-- and the existing on_submission_created / on_listing_report_created keep
-- pointing at them. Nothing to re-create here.
