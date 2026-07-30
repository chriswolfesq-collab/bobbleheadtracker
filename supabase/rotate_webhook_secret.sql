-- Rotate WEBHOOK_SECRET across every mailer at once.
--
-- Why this file exists: the shared secret is embedded as a literal in each
-- sender's function body, and the documented workflow is to hand-substitute
-- <WEBHOOK_SECRET> in six separate .sql files before running them. Miss one and
-- that mailer 401s forever — silently, because pg_net never surfaces a failed
-- response. That is exactly what happened: every function was installed with the
-- placeholder still in it, and net._http_response held nothing but 401s.
--
-- So this rewrites the functions in place instead of re-running the files. It
-- reads each definition back out with pg_get_functiondef, swaps whatever sits in
-- the x-webhook-secret header, and re-executes it. One value, one run, no file
-- left on disk with a live secret in it.
--
-- Run the three steps in order, top to bottom.

-- ---------------------------------------------------------------------------
-- Step 1 — dry run. Changes nothing.
-- ---------------------------------------------------------------------------
-- Every row should say will_rewrite = true. A false means the header is written
-- in a shape the pattern doesn't match, and that function needs doing by hand —
-- stop and look at it rather than running step 2 and assuming it was covered.
--
-- current_value is shown so you can see what each one is carrying today: the
-- literal <WEBHOOK_SECRET> means it was never substituted.

select
  p.proname,
  (regexp_match(p.prosrc, $re$'x-webhook-secret',\s*'([^']*)'$re$))[1] as current_value,
  regexp_replace(
    pg_get_functiondef(p.oid),
    $re$('x-webhook-secret',\s*')[^']*(')$re$,
    $rep$\1ROTATION_SENTINEL\2$rep$
  ) like '%ROTATION_SENTINEL%' as will_rewrite
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosrc like '%x-webhook-secret%'
order by p.proname;

-- ---------------------------------------------------------------------------
-- Step 2 — rotate.
-- ---------------------------------------------------------------------------
-- FIRST, in a terminal, mint the value and set it on the edge functions:
--
--   openssl rand -hex 32                     -- copy what this prints
--   npx supabase secrets set WEBHOOK_SECRET=<that value>
--
-- Then paste the same value below and run this block. Do not commit the file
-- with the value filled in -- restore the placeholder afterwards.

do $do$
declare
  r record;
  v_secret constant text := 'PASTE_NEW_SECRET_HERE';
  v_count int := 0;
begin
  -- Fail loudly rather than cheerfully writing the placeholder back in, which
  -- is the mistake this whole file exists to undo.
  --
  -- Matched on a fragment rather than the whole placeholder on purpose: the
  -- obvious way to fill this in is find-and-replace, and a guard spelling the
  -- token out in full gets replaced along with the declaration above — leaving
  -- it asking whether the secret equals the secret, and refusing every time.
  if v_secret like '%PASTE%' or v_secret like '<%' or length(v_secret) < 16 then
    raise exception 'Set v_secret on the line above to the real value first (no angle brackets).';
  end if;

  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc like '%x-webhook-secret%'
  loop
    execute regexp_replace(
      pg_get_functiondef(r.oid),
      $re$('x-webhook-secret',\s*')[^']*(')$re$,
      '\1' || v_secret || '\2'
    );
    v_count := v_count + 1;
  end loop;

  raise notice 'Rewrote % function(s).', v_count;
end
$do$;

-- ---------------------------------------------------------------------------
-- Step 3 — verify.
-- ---------------------------------------------------------------------------
-- Re-run step 1's query: current_value should now be the new secret on every
-- row, and no row should still read <WEBHOOK_SECRET>.
--
-- Then exercise a real sender and read what came back. send_weekly_digest is
-- the safe one to poke: it only mails people who collect a team with a
-- community addition in the window, and 365 days guarantees it finds something
-- to say rather than returning 0 for lack of news.

-- select public.send_weekly_digest(365);

-- Give pg_net a few seconds to record the response, then:

-- select status_code, created, left(content, 200) as body
--   from net._http_response order by created desc limit 5;

-- 200 is the goal. 401 means the edge functions and the database still disagree
-- about the secret -- check that `npx supabase secrets set` actually ran, since
-- setting the database side alone changes nothing.

-- ---------------------------------------------------------------------------
-- One place this file cannot reach
-- ---------------------------------------------------------------------------
-- The `submissions` webhook under Database > Webhooks carries x-webhook-secret
-- in its own header config, which lives outside pg_proc. Update it in the
-- dashboard by hand or new-submission notifications keep 401ing on their own.
