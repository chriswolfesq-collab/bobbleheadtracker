-- Fires the notify-new-submission Edge Function whenever a new row lands in
-- `submissions`. Uses pg_net (enabled by default on Supabase) instead of the
-- dashboard's Database Webhooks UI, so it's just another script to run once
-- in the SQL editor.
--
-- Replace <WEBHOOK_SECRET> below with the actual value before running --
-- it must match what was set via `supabase secrets set WEBHOOK_SECRET=...`.
-- Do not commit the filled-in version of this file.

create extension if not exists pg_net with schema extensions;

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
  if not public.can_edit_team(new.team_slug) then
    perform net.http_post(
      url := 'https://mawwzvnlihhsagatmolq.supabase.co/functions/v1/notify-new-submission',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', '<WEBHOOK_SECRET>'
      ),
      body := jsonb_build_object('type', 'INSERT', 'table', 'submissions', 'record', row_to_json(new))
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_submission_created on public.submissions;
create trigger on_submission_created
  after insert on public.submissions
  for each row
  execute function public.notify_new_submission();

-- Same edge function, reused for listing_reports (it branches on the
-- `table` field below). Requires the function to be redeployed with the
-- `listing_reports` handling in supabase/functions/notify-new-submission.

create or replace function public.notify_new_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://mawwzvnlihhsagatmolq.supabase.co/functions/v1/notify-new-submission',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '<WEBHOOK_SECRET>'
    ),
    body := jsonb_build_object('type', 'INSERT', 'table', 'listing_reports', 'record', row_to_json(new))
  );
  return new;
end;
$$;

drop trigger if exists on_listing_report_created on public.listing_reports;
create trigger on_listing_report_created
  after insert on public.listing_reports
  for each row
  execute function public.notify_new_report();

-- Mirror image of on_submission_created: emails the submitter (not the
-- admin) once their pending submission is approved or rejected. Looks up
-- the address from auth.users since submissions only stores submitted_by.
-- Same edge function, reused again (branches on payload.type = 'UPDATE').

create or replace function public.notify_submission_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = new.submitted_by;

  if v_email is not null then
    perform net.http_post(
      url := 'https://mawwzvnlihhsagatmolq.supabase.co/functions/v1/notify-new-submission',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', '<WEBHOOK_SECRET>'
      ),
      body := jsonb_build_object(
        'type', 'UPDATE',
        'table', 'submissions',
        'record', row_to_json(new),
        'submitter_email', v_email
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_submission_reviewed on public.submissions;
create trigger on_submission_reviewed
  after update on public.submissions
  for each row
  when (old.status = 'pending' and new.status in ('approved', 'rejected'))
  execute function public.notify_submission_reviewed();
