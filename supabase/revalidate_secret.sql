-- The shared secret notify_revalidate() authenticates with, and why it needs
-- the same Vault treatment the mailers got in supabase/webhook_secret.sql.
--
-- notify_revalidate() POSTs https://bobbleshelf.com/api/revalidate on every
-- change to bobblehead_overrides, approved_photos and community_bobbleheads.
-- app/api/revalidate/route.ts 401s unless the x-revalidate-secret header equals
-- the REVALIDATE_SECRET environment variable in the Vercel project (and 401s
-- outright when that variable is unset).
--
-- Confirmed broken on 2026-08-04: the deployed function still carried the
-- literal <REVALIDATE_SECRET> from revalidate_trigger.sql -- never substituted,
-- exactly the failure that left every mailer dead -- and the database had logged
-- 109 consecutive 401s in an hour.
--
-- It fails silently and it stales the site. net.http_post is fire-and-forget, so
-- nothing surfaces; and getApprovedPhotosMap in lib/curatedListing.ts is
-- unstable_cache(..., { revalidate: false }), i.e. tag-only. With this webhook
-- dead, an admin's photo or title edit never reaches the prerendered pages until
-- somebody redeploys the site.
--
--   Part 1  Health check -- is revalidation working? Run this any time.
--   Part 2  Fix -- paste the secret once, into Vault, not into a function body.
--   Part 3  Verify -- prove a call now returns 200.
--   Part 4  Rotating.
--
-- Safe to paste whole: Parts 1-3 run in order on a database that has never seen
-- this file. The one thing that cannot be batched is Part 3's second query --
-- net.http_post is asynchronous, so the response row does not exist yet when the
-- rest of the script finishes. Run that last select on its own, a few seconds
-- later. (The SQL editor aborts everything after the first error, so a statement
-- that fails takes the remainder of the file with it.)
--
-- Which value to paste: whatever Vercel has in REVALIDATE_SECRET (Project ->
-- Settings -> Environment Variables). That is the source of truth, and the copy
-- in the local .env.local is NOT it -- a hand POST with the local value 401'd on
-- 2026-08-04. If Vercel has no such variable, set one there first (any long
-- random string), redeploy so it takes effect, then use that same value below.

-- ===========================================================================
-- Part 1 - Health check
-- ===========================================================================

-- 1a. What the function is carrying. Never prints the secret itself.
--     PLACEHOLDER never substituted  -> revalidation is dead; run Part 2.
--     reads_from_vault = true        -> already migrated; check 1b and 1c.

select
  p.proname,
  case
    when m[1] is null then 'no literal found'
    when m[1] like '<%' then 'PLACEHOLDER never substituted'
    else 'real value, length ' || length(m[1])::text || ', md5 ' || left(md5(m[1]), 8)
  end as secret_state,
  p.prosrc like '%revalidate_secret()%' as reads_from_vault
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace,
lateral regexp_match(p.prosrc, $re$'x-revalidate-secret',\s*'([^']*)'$re$) as m
where n.nspname = 'public' and p.prosrc like '%x-revalidate-secret%';

-- 1b. Can the accessor resolve the secret at all? False after Part 2 means the
--     Vault row is missing or empty, and every call is 401ing regardless of 1a.
--
--     Wrapped in a DO block, and calling the accessor dynamically, so that a
--     whole-file paste survives the first run: before Part 2 the function does
--     not exist, and a bare `select public.revalidate_secret()` would fail to
--     even parse -- taking the rest of the script down with it, since the SQL
--     editor aborts everything after the first error. Read the result in the
--     Messages/Notices pane, not the results grid.

do $do$
declare
  v_readable boolean;
begin
  if to_regproc('public.revalidate_secret') is null then
    raise notice 'vault_readable: n/a -- revalidate_secret() does not exist yet; Part 2 has not been run.';
  else
    execute 'select public.revalidate_secret() is not null' into v_readable;
    raise notice 'vault_readable: %', v_readable;
  end if;
end
$do$;

-- 1c. What the database actually got back -- the only honest answer. Anything
--     other than 200 means the site is not refreshing.
--
--     net._http_response does NOT record the URL (its columns are id,
--     status_code, content_type, headers, content, timed_out, error_msg,
--     created), so this cannot be filtered to the revalidate calls: the mailer
--     webhooks land in the same table. The response body tells them apart --
--     this route answers {"revalidated":true} or the bare word Unauthorized.
--
--     Pruned after a few hours, so an empty result means "nothing sent
--     recently", not "nothing ever failed".

select
  status_code,
  left(content, 40) as body,
  count(*) as calls,
  min(created) as first,
  max(created) as latest
from net._http_response
group by status_code, left(content, 40)
order by calls desc;

-- ===========================================================================
-- Part 2 - Fix
-- ===========================================================================
-- Replace <PASTE_VERCEL_REVALIDATE_SECRET> in 2a with the value from Vercel.
-- That is the only place a value is typed; 2b and 2c carry none, so nothing has
-- to be substituted again the next time this function is edited.

-- 2a. Store it in Vault.

create extension if not exists supabase_vault with schema vault;

do $do$
declare
  v_secret text := '<PASTE_VERCEL_REVALIDATE_SECRET>';
  v_id uuid;
begin
  if v_secret like '<%' then
    raise exception 'Paste the Vercel REVALIDATE_SECRET into 2a first.';
  end if;

  select id into v_id from vault.secrets where name = 'revalidate_secret';

  if v_id is null then
    perform vault.create_secret(
      v_secret,
      'revalidate_secret',
      'x-revalidate-secret header for https://bobbleshelf.com/api/revalidate. Must match REVALIDATE_SECRET in the Vercel project.'
    );
    raise notice 'Stored revalidate_secret in Vault.';
  else
    perform vault.update_secret(v_id, v_secret);
    raise notice 'Updated the existing revalidate_secret in Vault.';
  end if;
end
$do$;

-- 2b. The accessor. security definer so it can read vault.decrypted_secrets,
--     then execute revoked from everyone -- the only caller left is
--     notify_revalidate(), itself security definer and running as the owner.
--
--     Warns and returns null rather than raising when the secret is missing:
--     notify_revalidate() fires from INSERT/UPDATE/DELETE triggers, so raising
--     would abort the user's edit rather than merely failing to refresh a cache.
--     Null degrades to the same 401 as before, which Part 1c catches.

create or replace function public.revalidate_secret()
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
  where name = 'revalidate_secret'
  limit 1;

  if v_secret is null or v_secret = '' then
    raise warning 'revalidate_secret is not set in Vault; /api/revalidate calls will 401';
    return null;
  end if;

  return v_secret;
end;
$$;

revoke all on function public.revalidate_secret() from public, anon, authenticated;

-- 2c. The trigger function, now reading the secret instead of embedding it.
--     The three triggers in supabase/revalidate_trigger.sql already point at
--     this function, so replacing the body is the whole change.

create or replace function public.notify_revalidate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://bobbleshelf.com/api/revalidate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-revalidate-secret', public.revalidate_secret()
    ),
    body := '{}'::jsonb
  );
  return coalesce(new, old);
end;
$$;

-- ===========================================================================
-- Part 3 - Verify
-- ===========================================================================
-- Send one call by hand rather than editing a listing to provoke a trigger.

select net.http_post(
  url := 'https://bobbleshelf.com/api/revalidate',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-revalidate-secret', public.revalidate_secret()
  ),
  body := '{}'::jsonb
) as request_id;

-- RUN THIS ONE ON ITS OWN, a few seconds after the rest. net.http_post queues
-- the request and returns immediately, so in a single batch this select runs
-- before the response lands. The row whose id matches the request_id above is
-- the one to read -- the table holds the mailer webhooks too and has no URL
-- column to filter by, so identify this call by its id or its body.
--
-- 200 with {"revalidated":true} is the fix landing; 401 (body: Unauthorized)
-- means the value in Vault still isn't what Vercel holds.

select id, status_code, left(content, 60) as body, error_msg, created
from net._http_response
order by created desc
limit 5;

-- ===========================================================================
-- Part 4 - Rotating
-- ===========================================================================
-- Change it in Vercel, redeploy so the new value is live, then re-run 2a with
-- the new value. Nothing else needs touching: notify_revalidate() reads Vault at
-- call time, so no function body carries the old value.
