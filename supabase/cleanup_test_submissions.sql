-- Cleanup: remove leftover QA/test rows from the submissions review queue
-- (e.g. "QA Marlins Test", "Test No Date").
--
-- WHY THIS IS A SCRIPT AND NOT DONE IN THE APP: pending submissions are only
-- readable/deletable by an admin (RLS), and the service-role key lives only in
-- the server environment — never locally — so these rows can't be reached from
-- a dev machine. Run this in the Supabase SQL editor (Dashboard → SQL), which
-- runs as the service role and bypasses RLS.
--
-- The community_bobbleheads table was checked separately and is clean (no test
-- rows leaked through to approved listings), so this only touches submissions.
--
-- HOW TO USE:
--   1. Run STEP 1 and eyeball the rows it returns. Because the queue may hold
--      test rows whose titles don't contain "test"/"qa", scan the full pending
--      list too (STEP 0) and widen the WHERE in STEP 1/STEP 2 if needed.
--   2. Only once STEP 1 shows exactly what you want gone, run STEP 2 to delete.
--      DELETE is irreversible — there is no undo.

-- STEP 0 (optional) — see the whole pending queue so nothing test-y is missed:
-- select id, kind, team_slug, title, year, date, status, created_at
-- from public.submissions
-- where status = 'pending'
-- order by created_at desc;

-- STEP 1 — PREVIEW the rows that STEP 2 will delete. Run this first.
select id, kind, team_slug, title, year, date, status, created_at
from public.submissions
where title ~* '\mtest\M'      -- "Test No Date", "QA Marlins Test", …
   or title ~* '\mqa\M'        -- "QA ..." rows
   or date  ~* '\mtest\M'      -- placeholder dates like "test"
   or coalesce(trim(title), '') = ''  -- empty-title junk
order by created_at desc;

-- STEP 2 — DELETE. Run ONLY after STEP 1 shows the exact rows you want removed.
-- Keep the WHERE identical to STEP 1 (adjust both together if you widened it).
-- begin;
-- delete from public.submissions
-- where title ~* '\mtest\M'
--    or title ~* '\mqa\M'
--    or date  ~* '\mtest\M'
--    or coalesce(trim(title), '') = '';
-- -- Verify the deleted count looks right, then:
-- commit;   -- (or `rollback;` to abort if something looks off)
