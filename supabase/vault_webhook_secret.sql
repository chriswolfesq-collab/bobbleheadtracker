-- Move WEBHOOK_SECRET out of eight function bodies and into Vault.
--
-- Today the shared secret is a string literal inside every sender, put there by
-- hand-substituting <WEBHOOK_SECRET> before running each .sql file. That is the
-- design that let every mailer on this site sit broken for months: one file run
-- without the substitution fails silently forever, and there is no single place
-- to look at or change. After this, the literal appears nowhere — each sender
-- asks public.webhook_secret() at call time, and rotating means updating one
-- Vault row and the edge-function secret to match.
--
-- Run the steps in order. Steps 1 and 3 report; steps 2 and 4 change things.
-- Nothing here needs you to paste the secret: step 2 lifts it out of a function
-- body that already has it.

-- ---------------------------------------------------------------------------
-- Step 1 - what's there now. Changes nothing.
-- ---------------------------------------------------------------------------
-- Expect 8 rows, every current_value showing the same real secret. If any row
-- reads <WEBHOOK_SECRET> the senders disagree with each other -- run
-- rotate_webhook_secret.sql first and come back, because step 2 migrates
-- whichever value it finds and you want that to be the right one.

select
  p.proname,
  (regexp_match(p.prosrc, $re$'x-webhook-secret',\s*'([^']*)'$re$))[1] as current_value
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosrc like '%x-webhook-secret%'
order by p.proname;

-- ---------------------------------------------------------------------------
-- Step 2 - put the secret in Vault and add the accessor.
-- ---------------------------------------------------------------------------

create extension if not exists supabase_vault with schema vault;

do $do$
declare
  v_secret text;
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'webhook_secret';

  -- Already migrated. Re-running this file must not try to recover a literal
  -- from functions that no longer carry one, so this exits early rather than
  -- failing the "nothing to migrate" check below.
  if v_id is not null then
    raise notice 'Vault already holds webhook_secret; leaving it alone.';
    return;
  end if;

  -- Lift the value from whichever sender still has it. Any of them will do --
  -- step 1 is where you confirm they agree.
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
      'No sender carries a usable secret to migrate. Run rotate_webhook_secret.sql first.';
  end if;

  perform vault.create_secret(
    v_secret,
    'webhook_secret',
    'Shared x-webhook-secret header for the edge-function mailers. Must match `npx supabase secrets set WEBHOOK_SECRET=...`.'
  );
  raise notice 'Stored webhook_secret in Vault.';
end
$do$;

-- The accessor every sender will call.
--
-- security definer so it can read vault.decrypted_secrets, which ordinary roles
-- cannot -- and then execute is revoked from everyone, so the only callers left
-- are the sender functions, which are themselves security definer and so run as
-- the owner. An authenticated user calling this directly gets permission denied
-- rather than the secret.
--
-- Warns and returns null instead of raising when the secret is missing. Most of
-- these senders are INSERT triggers: raising would abort the transaction, so a
-- misconfigured secret would stop someone submitting a bobblehead rather than
-- merely failing to email about it. Null degrades to the same 401 as before,
-- which step 4 is how you catch.
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

-- ---------------------------------------------------------------------------
-- Step 3 - dry run of the rewrite. Changes nothing.
-- ---------------------------------------------------------------------------
-- Every row should say will_rewrite = true. A false is a sender writing its
-- header in a shape the pattern doesn't match; stop and fix that one by hand
-- rather than running step 4 and assuming it was covered.

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

-- ---------------------------------------------------------------------------
-- Step 4 - swap the literals for the call.
-- ---------------------------------------------------------------------------

do $do$
declare
  r record;
  v_count int := 0;
begin
  -- Refuse to strip the literals out of the senders while Vault has nothing to
  -- replace them with -- that would take every mailer down at once.
  if public.webhook_secret() is null then
    raise exception 'Vault has no webhook_secret. Run step 2 first.';
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

-- ---------------------------------------------------------------------------
-- Step 5 - verify.
-- ---------------------------------------------------------------------------
-- Re-run step 1's query. current_value should now be null on every row -- there
-- is no literal left to match. Then confirm the accessor works and a real send
-- still authenticates:
--
--   select public.webhook_secret() is not null as vault_readable;
--   select public.send_weekly_digest(365);
--
-- Wait a few seconds, then:
--
--   select status_code, created, left(content, 200) as body
--     from net._http_response order by created desc limit 5;
--
-- 200 means the migration worked. Note that send_weekly_digest(365) sends real
-- email to real collectors -- use a narrow window, or a different sender, if you
-- would rather not.

-- ---------------------------------------------------------------------------
-- Rotating, after this
-- ---------------------------------------------------------------------------
-- Two places, and no SQL files to edit:
--
--   npx supabase secrets set WEBHOOK_SECRET=<new value>
--
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'webhook_secret'),
--     '<new value>'
--   );
--
-- rotate_webhook_secret.sql is only needed for senders still holding a literal.
-- Once this file has run, it has nothing to find.
