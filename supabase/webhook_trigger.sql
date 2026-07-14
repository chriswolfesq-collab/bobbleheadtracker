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
  perform net.http_post(
    url := 'https://mawwzvnlihhsagatmolq.supabase.co/functions/v1/notify-new-submission',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '<WEBHOOK_SECRET>'
    ),
    body := jsonb_build_object('type', 'INSERT', 'table', 'submissions', 'record', row_to_json(new))
  );
  return new;
end;
$$;

drop trigger if exists on_submission_created on public.submissions;
create trigger on_submission_created
  after insert on public.submissions
  for each row
  execute function public.notify_new_submission();
