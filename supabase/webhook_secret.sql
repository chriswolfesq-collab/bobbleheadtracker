-- Everything about the shared secret the mailers authenticate with.
--
-- Every trigger-driven sender POSTs to an edge function with an
-- x-webhook-secret header, and the function 401s on a mismatch. net.http_post
-- is fire-and-forget, so a wrong secret produces no error anywhere: the sender
-- returns success, the admin UI shows nothing, and the symptom is email that
-- doesn't arrive -- indistinguishable from email nobody triggered.
--
-- That is not hypothetical. Every sender in this project was once installed with
-- the literal <WEBHOOK_SECRET> still in it, because the setup instructions asked
-- you to hand-substitute it in six separate files. No automated email this site
-- sends had ever worked, and nothing said so.
--
-- The secret now lives in Vault and each sender calls public.webhook_secret() at
-- send time, so no file carries a value and there is nothing to substitute or
-- forget. This file covers all of it:
--
--   Part 1  Health check -- is email working? Run this any time.
--   Part 2  Migration -- for a fresh database, or one still holding literals.
--   Part 3  Rotating.
--   Part 4  Recovery -- putting literals back in step if Part 2 can't run yet.
--
-- On the live database Part 2 is already done. Parts 1 and 3 are the ones you
-- come back for.

-- ===========================================================================
-- Part 1 - Health check
-- ===========================================================================

-- 1a. What every sender is carrying. After the migration, reads_from_vault is
--     true and literal_left is null on all 8 rows -- the null is correct, not a
--     fault. A row showing <WEBHOOK_SECRET> was never substituted and that
--     mailer is dead; see Part 4.

select
  p.proname,
  (regexp_match(p.prosrc, $re$'x-webhook-secret',\s*'([^']*)'$re$))[1] as literal_left,
  p.prosrc like '%webhook_secret()%' as reads_from_vault
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosrc like '%x-webhook-secret%'
  and p.proname <> 'webhook_secret'
order by p.proname;

-- 1b. Can the accessor actually resolve the secret? False means every mailer is
--     401ing right now, whatever 1a says.

select public.webhook_secret() is not null as vault_readable;

-- 1c. What the database actually got back. This is the only honest answer about
--     whether email works -- a sender returning without error proves nothing.
--     Anything other than 200 means that path is broken.
--
--     net._http_response is pruned on a TTL of a few hours, so an empty result
--     means "nothing sent recently", not "nothing ever failed".

select status_code, count(*) as calls, min(created) as first, max(created) as latest
from net._http_response
group by status_code
order by calls desc;

-- ===========================================================================
-- Part 2 - Migration
-- ===========================================================================
-- Already applied to the live database. Needed for a fresh setup, or a restore
-- from a backup old enough to predate it. Nothing here asks you to paste the
-- secret: 2b lifts it out of a function body that already has it.

-- 2a. Dry run. Changes nothing. Every row should say will_rewrite = true; a
--     false is a sender writing its header in a shape the pattern doesn't
--     match, and needs doing by hand rather than being assumed covered.

select
  p.proname,
  regexp_replace(
    pg_get_functiondef(p.oid),
    $re$('x-webhook-secret',\s*)'[^']*'$re$,
    $rep$\1REWRITE_SENTINEL$rep$
  ) like '%REWRITE_SENTINEL%' as will_rewrite
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosrc like '%x-webhook-secret%'
  and p.proname <> 'webhook_secret'
order by p.proname;

-- 2b. Put the secret in Vault.

create extension if not exists supabase_vault with schema vault;

do $do$
declare
  v_secret text;
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'webhook_secret';

  -- Already migrated. Re-running must not try to recover a literal from
  -- functions that no longer carry one, so this exits before the check below.
  if v_id is not null then
    raise notice 'Vault already holds webhook_secret; leaving it alone.';
    return;
  end if;

  select (regexp_match(p.prosrc, $re$'x-webhook-secret',\s*'([^']*)'$re$))[1]
  into v_secret
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosrc like '%x-webhook-secret%'
    and (regexp_match(p.prosrc, $re$'x-webhook-secret',\s*'([^']*)'$re$))[1] not like '<%'
  limit 1;

  if v_secret is null or length(v_secret) < 16 then
    raise exception
      'No sender carries a usable secret to migrate. Use Part 4 first, or create the Vault secret by hand.';
  end if;

  perform vault.create_secret(
    v_secret,
    'webhook_secret',
    'Shared x-webhook-secret header for the edge-function mailers. Must match `npx supabase secrets set WEBHOOK_SECRET=...`.'
  );
  raise notice 'Stored webhook_secret in Vault.';
end
$do$;

-- 2c. The accessor every sender calls.
--
-- security definer so it can read vault.decrypted_secrets, which ordinary roles
-- cannot -- then execute is revoked from everyone, so the only callers left are
-- the senders, which are themselves security definer and run as the owner. An
-- authenticated user asking directly gets permission denied rather than the
-- secret.
--
-- Warns and returns null rather than raising when the secret is missing. Most of
-- these senders are INSERT triggers: raising would abort the transaction, so a
-- misconfigured secret would stop someone submitting a bobblehead rather than
-- merely failing to email about it. Null degrades to the same 401 as before,
-- which Part 1c catches.

create or replace function public.webhook_secret()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'webhook_secret'
  limit 1;

  if v_secret is null or v_secret = '' then
    raise warning 'webhook_secret is not set in Vault; outbound webhook calls will 401';
    return null;
  end if;

  return v_secret;
end;
$$;

revoke all on function public.webhook_secret() from public, anon, authenticated;

-- 2d. Swap the literals for the call.

do $do$
declare
  r record;
  v_count int := 0;
begin
  -- Refuse to strip literals while Vault has nothing to replace them with --
  -- that would take every mailer down at once.
  if public.webhook_secret() is null then
    raise exception 'Vault has no webhook_secret. Run 2b first.';
  end if;

  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc like '%x-webhook-secret%'
      and p.proname <> 'webhook_secret'
  loop
    execute regexp_replace(
      pg_get_functiondef(r.oid),
      $re$('x-webhook-secret',\s*)'[^']*'$re$,
      $rep$\1public.webhook_secret()$rep$
    );
    v_count := v_count + 1;
  end loop;

  raise notice 'Rewrote % sender(s) to read from Vault.', v_count;
end
$do$;

-- 2e. Verify with Part 1, then send something real. Note that
--     send_weekly_digest emails actual collectors -- keep the window narrow.
--
--       select public.send_weekly_digest(7);
--       -- wait a few seconds, then Part 1c

-- ===========================================================================
-- Part 3 - Rotating
-- ===========================================================================
-- Two places, no files to edit. Both halves must move together: changing one
-- alone swaps a working secret for a 401.
--
--   npx supabase secrets set WEBHOOK_SECRET=<new value>
--
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'webhook_secret'),
--     '<new value>'
--   );
--
-- Then confirm with Part 1c. Generate a value with `openssl rand -hex 32`.

-- ===========================================================================
-- Part 4 - Recovery
-- ===========================================================================
-- If Part 1a shows senders holding literals -- a restored backup, or an old
-- .sql file re-run from git history -- this puts them back in step without
-- needing Vault. Prefer Part 2, which removes the literals entirely; this is
-- for getting email working again first.
--
-- Uncomment, set the value, run. It refuses to run against the placeholder: the
-- guard matches a fragment rather than the whole token on purpose, because
-- find-and-replace would otherwise swap the guard's copy too and leave it
-- asking whether the secret equals the secret.

-- do $do$
-- declare
--   r record;
--   v_secret constant text := 'PASTE_SECRET_HERE';
--   v_count int := 0;
-- begin
--   if v_secret like '%PASTE%' or v_secret like '<%' or length(v_secret) < 16 then
--     raise exception 'Set v_secret on the line above to the real value first.';
--   end if;
--
--   for r in
--     select p.oid
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public'
--       and p.prosrc like '%x-webhook-secret%'
--       and p.proname <> 'webhook_secret'
--   loop
--     execute regexp_replace(
--       pg_get_functiondef(r.oid),
--       $re$('x-webhook-secret',\s*')[^']*(')$re$,
--       '\1' || v_secret || '\2'
--     );
--     v_count := v_count + 1;
--   end loop;
--
--   raise notice 'Rewrote % function(s).', v_count;
-- end
-- $do$;
