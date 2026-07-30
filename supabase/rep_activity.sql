-- Team rep activity log + the daily digest email.
-- Run once in the Supabase SQL editor after email_preferences.sql; safe to re-run.
--
-- Nothing in the schema recorded *who* did what. bobblehead_overrides and
-- approved_photos carry an updated_by/approved_by, but submissions and
-- listing_reports only carry a reviewed_at — so "what did the reps do today"
-- couldn't be answered, let alone emailed. This adds one append-only log that
-- every rep- and admin-facing write path drops a row into.
--
-- Why triggers rather than writing the log from the app: reps act through
-- several paths (the team page's inline edit, the review queue, the reports
-- page, bulk actions) and some of those are SECURITY DEFINER RPCs. A trigger on
-- the underlying table catches all of them, including any path added later,
-- which app-side logging would quietly miss.
--
-- Who the actor is: auth.uid(), not the row's *_by column. SECURITY DEFINER
-- changes the executing role but leaves the JWT claims alone, so auth.uid()
-- inside a trigger fired from approve_submission() is still the rep who called
-- it. The *_by column is used as a fallback for the paths that set it.

-- ---------------------------------------------------------------------------
-- The log
-- ---------------------------------------------------------------------------
create table if not exists public.rep_activity (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  -- Denormalized on purpose: the digest names people, and an account deleted
  -- later shouldn't turn its history into a row of nulls. Also covers the case
  -- where actor_id is null because the write came from a path with no session.
  actor_email text,
  action text not null,
  team_slug text,
  bobblehead_id text,
  -- Short human-readable summary, already phrased for the email.
  detail text,
  created_at timestamptz not null default now()
);

-- The digest reads a day at a time and the admin page reads newest-first, so
-- both want this index rather than a full scan of a table that only grows.
create index if not exists rep_activity_created_at_idx
  on public.rep_activity (created_at desc);

alter table public.rep_activity enable row level security;

-- Admins see everything; a rep sees their own trail and nothing else. No insert
-- or update policy at all — rows come only from the SECURITY DEFINER trigger
-- below, so the log can't be forged or edited from a client.
drop policy if exists "rep_activity: admin select" on public.rep_activity;
create policy "rep_activity: admin select"
  on public.rep_activity for select
  using (public.is_admin());

drop policy if exists "rep_activity: own select" on public.rep_activity;
create policy "rep_activity: own select"
  on public.rep_activity for select
  using (actor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- One writer, used by every trigger
-- ---------------------------------------------------------------------------
create or replace function public.log_rep_activity(
  p_action text,
  p_team_slug text,
  p_bobblehead_id text,
  p_detail text,
  p_fallback_actor uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), p_fallback_actor);
  v_email text;
begin
  select email into v_email from auth.users where id = v_actor;

  insert into public.rep_activity (actor_id, actor_email, action, team_slug, bobblehead_id, detail)
  values (v_actor, v_email, p_action, p_team_slug, p_bobblehead_id, p_detail);
end;
$$;

revoke all on function public.log_rep_activity(text, text, text, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers, one per table a rep can change
-- ---------------------------------------------------------------------------

-- Curated listing text edits, and the soft-delete tombstone.
create or replace function public.log_override_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted and (tg_op = 'INSERT' or not coalesce(old.deleted, false)) then
    perform public.log_rep_activity(
      'listing_deleted', new.team_slug, new.bobblehead_id,
      'Deleted listing ' || new.bobblehead_id, new.updated_by);
  elsif tg_op = 'UPDATE' and coalesce(old.deleted, false) and not new.deleted then
    perform public.log_rep_activity(
      'listing_restored', new.team_slug, new.bobblehead_id,
      'Restored listing ' || new.bobblehead_id, new.updated_by);
  elsif new.photo_hidden and (tg_op = 'INSERT' or not coalesce(old.photo_hidden, false)) then
    perform public.log_rep_activity(
      'photo_removed', new.team_slug, new.bobblehead_id,
      'Removed the photo on ' || new.bobblehead_id, new.updated_by);
  else
    perform public.log_rep_activity(
      'listing_edited', new.team_slug, new.bobblehead_id,
      'Edited ' || coalesce(new.title, new.bobblehead_id), new.updated_by);
  end if;
  return new;
end;
$$;

drop trigger if exists log_bobblehead_override on public.bobblehead_overrides;
create trigger log_bobblehead_override
  after insert or update on public.bobblehead_overrides
  for each row
  execute function public.log_override_change();

-- A photo becoming the listing's main image.
create or replace function public.log_photo_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_rep_activity(
    'photo_set', new.team_slug, new.bobblehead_id,
    'Set the main photo on ' || new.bobblehead_id, new.approved_by);
  return new;
end;
$$;

drop trigger if exists log_approved_photo on public.approved_photos;
create trigger log_approved_photo
  after insert or update on public.approved_photos
  for each row
  execute function public.log_photo_approved();

-- A community-submitted bobblehead going live.
create or replace function public.log_community_bobblehead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_rep_activity(
    'bobblehead_added', new.team_slug, new.id,
    'Added ' || coalesce(new.title, new.id), new.approved_by);
  return new;
end;
$$;

drop trigger if exists log_community_bobblehead_added on public.community_bobbleheads;
create trigger log_community_bobblehead_added
  after insert on public.community_bobbleheads
  for each row
  execute function public.log_community_bobblehead();

-- A gallery photo being approved onto a listing.
create or replace function public.log_gallery_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_rep_activity(
    'gallery_photo_approved', new.team_slug, new.bobblehead_id,
    'Approved a gallery photo on ' || new.bobblehead_id, new.approved_by);
  return new;
end;
$$;

drop trigger if exists log_gallery_photo_added on public.bobblehead_gallery_photos;
create trigger log_gallery_photo_added
  after insert on public.bobblehead_gallery_photos
  for each row
  execute function public.log_gallery_photo();

-- Review decisions on the submission queue. This is the one the schema had no
-- way to attribute at all.
create or replace function public.log_submission_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_rep_activity(
    case when new.status = 'approved' then 'submission_approved' else 'submission_rejected' end,
    new.team_slug,
    coalesce(new.target_bobblehead_id, new.title),
    case when new.status = 'approved' then 'Approved' else 'Rejected' end ||
      ' the submission for ' || coalesce(new.title, new.target_bobblehead_id, 'a listing'),
    null);
  return new;
end;
$$;

drop trigger if exists log_submission_review on public.submissions;
create trigger log_submission_review
  after update on public.submissions
  for each row
  when (old.status = 'pending' and new.status in ('approved', 'rejected'))
  execute function public.log_submission_reviewed();

-- Resolving or dismissing a listing report.
create or replace function public.log_report_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_rep_activity(
    case when new.status = 'resolved' then 'report_resolved' else 'report_dismissed' end,
    new.team_slug,
    new.bobblehead_id,
    case when new.status = 'resolved' then 'Resolved' else 'Dismissed' end ||
      ' the report on ' || coalesce(new.title, new.bobblehead_id),
    null);
  return new;
end;
$$;

drop trigger if exists log_report_review on public.listing_reports;
create trigger log_report_review
  after update on public.listing_reports
  for each row
  when (old.status = 'pending' and new.status in ('resolved', 'dismissed'))
  execute function public.log_report_reviewed();

-- ---------------------------------------------------------------------------
-- The daily digest
-- ---------------------------------------------------------------------------
-- Aggregates the window in SQL and hands the finished summary to a dumb mailer,
-- matching notify-wishlist-owner and notify-team-rep: the function that sends
-- never touches the database, so it needs no service-role key.
--
-- Only counts activity by *reps*, not by full admins — the point of the email is
-- to tell the owner what other people changed, and an admin already knows what
-- they themselves did. Remove the team_reps filter below to include everyone.
create extension if not exists pg_net with schema extensions;

-- Replace <WEBHOOK_SECRET> below with the real value before running -- it must
-- match `supabase secrets set WEBHOOK_SECRET=...` (shared with the other
-- functions). Do not commit the filled-in version of this file.
create or replace function public.send_rep_activity_digest(p_hours int default 24)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(hours => greatest(p_hours, 1));
  v_actors jsonb;
  v_total int;
  v_recipients jsonb;
begin
  -- One entry per rep, with their action counts and a sample of what they did.
  select
    coalesce(jsonb_agg(a order by a.total desc), '[]'::jsonb),
    coalesce(sum(a.total), 0)
  into v_actors, v_total
  from (
    select
      r.actor_email as email,
      count(*)::int as total,
      -- Cap the per-person detail list: a bulk edit session can be hundreds of
      -- rows and the email only needs to show the shape of it.
      (array_agg(r.detail order by r.created_at desc))[1:8] as samples,
      array_agg(distinct r.action) as actions,
      array_remove(array_agg(distinct r.team_slug), null) as teams
    from public.rep_activity r
    where r.created_at >= v_since
      and r.actor_email is not null
      -- Reps only; see the note above.
      and exists (select 1 from public.team_reps tr where lower(tr.email) = lower(r.actor_email))
    group by r.actor_email
  ) a;

  -- Nothing happened: send nothing. A daily "no activity" email is how a digest
  -- teaches people to ignore it.
  if v_total = 0 then
    return 0;
  end if;

  -- Every admin who hasn't turned the digest off.
  select jsonb_agg(u.email)
  into v_recipients
  from public.admins ad
  join auth.users u on lower(u.email) = lower(ad.email)
  where public.wants_email(u.id, 'rep_digest');

  if v_recipients is null or jsonb_array_length(v_recipients) = 0 then
    return 0;
  end if;

  perform net.http_post(
    url := 'https://mawwzvnlihhsagatmolq.supabase.co/functions/v1/rep-activity-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '<WEBHOOK_SECRET>'
    ),
    body := jsonb_build_object(
      'recipients', v_recipients,
      'hours', greatest(p_hours, 1),
      'total', v_total,
      'actors', v_actors
    )
  );

  return v_total;
end;
$$;

revoke all on function public.send_rep_activity_digest(int) from public, anon;
-- Admins can fire it by hand from the admin console to check the wiring without
-- waiting for the schedule.
grant execute on function public.send_rep_activity_digest(int) to authenticated;

-- ---------------------------------------------------------------------------
-- The schedule
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;

-- 04:00 UTC is midnight US Eastern, so the digest lands at the end of the day it
-- describes and its 24-hour window lines up with that day. Change the cron
-- expression to move it; unschedule first because cron.schedule on an existing
-- name would stack a second job.
select cron.unschedule('rep-activity-digest')
where exists (select 1 from cron.job where jobname = 'rep-activity-digest');

select cron.schedule(
  'rep-activity-digest',
  '0 4 * * *',
  $$select public.send_rep_activity_digest(24)$$
);
