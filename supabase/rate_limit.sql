-- Rate limiting for the two public write paths: bobblehead submissions and
-- listing reports. Run once in the Supabase SQL editor; safe to re-run.
--
-- Both tables are insert-only from the site and always carry the submitter's
-- id (submitted_by references auth.users), so the cheapest robust throttle is
-- a BEFORE INSERT trigger that counts the user's own recent rows and rejects
-- once they cross a threshold. SECURITY DEFINER so the count sees all of the
-- user's rows regardless of the RLS policies on these tables.
--
-- Rejections are raised with SQLSTATE 'BB429' so the client can recognize a
-- rate-limit refusal and show friendly copy (see lib/rateLimit.ts). The
-- message text here is already user-ready in case it surfaces directly.
--
-- Note: the pending photo upload happens a moment before the submissions
-- insert, so a determined actor could still spam Storage without tripping
-- this. Accepted for now — this closes the realistic "flood the review queue"
-- vector at zero infra cost. Thresholds below are the only knobs to tune.

create or replace function public.enforce_submission_rate_limit()
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
  from public.submissions
  where submitted_by = new.submitted_by
    and created_at > now() - interval '1 hour';

  select count(*) into v_last_day
  from public.submissions
  where submitted_by = new.submitted_by
    and created_at > now() - interval '24 hours';

  if v_last_hour >= 5 or v_last_day >= 30 then
    raise exception 'You''re submitting too quickly. Please wait a bit and try again.'
      using errcode = 'BB429';
  end if;

  return new;
end;
$$;

drop trigger if exists rate_limit_submissions on public.submissions;
create trigger rate_limit_submissions
  before insert on public.submissions
  for each row
  execute function public.enforce_submission_rate_limit();

create or replace function public.enforce_report_rate_limit()
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
  from public.listing_reports
  where submitted_by = new.submitted_by
    and created_at > now() - interval '1 hour';

  select count(*) into v_last_day
  from public.listing_reports
  where submitted_by = new.submitted_by
    and created_at > now() - interval '24 hours';

  if v_last_hour >= 10 or v_last_day >= 50 then
    raise exception 'You''re reporting too quickly. Please wait a bit and try again.'
      using errcode = 'BB429';
  end if;

  return new;
end;
$$;

drop trigger if exists rate_limit_listing_reports on public.listing_reports;
create trigger rate_limit_listing_reports
  before insert on public.listing_reports
  for each row
  execute function public.enforce_report_rate_limit();
