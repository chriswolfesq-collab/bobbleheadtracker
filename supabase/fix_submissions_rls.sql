-- Fix: "new row violates row-level security policy" when submitting a bobblehead.
--
-- Cause: the live database's RLS on public.submissions (and/or the pending
-- storage bucket) drifted from schema.sql -- most likely RLS is enabled on the
-- table with no permissive INSERT policy, so every submit is rejected.
--
-- This re-applies exactly the policies schema.sql defines for the submit path.
-- Idempotent (drop-if-exists / create): if a policy is already correct this
-- changes nothing; if it's missing or wrong, this restores it. Safe to re-run.
-- Run once in the Supabase SQL Editor.

-- 1) Diagnostic -- see what's actually on the table right now (optional).
--    Expect a "submissions: submitter insert" row for {authenticated} whose
--    with_check is (auth.uid() = submitted_by). If it's absent, that's the bug.
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'submissions';

-- 2) The submissions table policies (from schema.sql).
alter table public.submissions enable row level security;

drop policy if exists "submissions: submitter insert" on public.submissions;
create policy "submissions: submitter insert"
  on public.submissions for insert
  to authenticated
  with check (auth.uid() = submitted_by);

drop policy if exists "submissions: submitter or admin select" on public.submissions;
create policy "submissions: submitter or admin select"
  on public.submissions for select
  to authenticated
  using (auth.uid() = submitted_by or public.is_admin());

-- 3) The pending-bucket storage policies (from schema.sql), in case the submit
--    included a photo and the failure is on the upload rather than the row.
--    Pending uploads live at `<user-id>/<filename>`, so the folder name is the
--    ownership check.
drop policy if exists "pending: owner can upload" on storage.objects;
create policy "pending: owner can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bobblehead-pending'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "pending: owner or admin can view" on storage.objects;
create policy "pending: owner or admin can view"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bobblehead-pending'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- 4) Re-run the diagnostic to confirm the insert policy is now present.
select policyname, cmd, roles, with_check
from pg_policies
where schemaname = 'public' and tablename = 'submissions'
order by cmd;
