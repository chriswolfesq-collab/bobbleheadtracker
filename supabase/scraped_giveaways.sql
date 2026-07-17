-- New-giveaway scraper queue. Run once in the Supabase SQL editor; safe to
-- re-run.
--
-- A scheduled Vercel Cron job (vercel.json -> /api/giveaway-scrape) crawls each
-- team's promo-schedule page (lib/promoSources.ts), extracts bobblehead
-- giveaways it hasn't seen before, and drafts them here for the admin to review
-- at /admin/scraped-giveaways — so new giveaways no longer have to be
-- hand-edited into data/giveaways/*.json.
--
-- The scraper writes with the service-role key, which bypasses RLS, so there is
-- deliberately NO insert policy below. Reads and the "dismiss" update are gated
-- to admin-mode accounts via public.is_admin(), exactly like dead_images.
-- "Approve" goes through the approve_scraped_giveaway() SECURITY DEFINER
-- function, which also inserts the live listing.

create table if not exists public.scraped_giveaways (
  id uuid primary key default gen_random_uuid(),
  team_slug text not null,
  title text not null,
  year text not null,
  date text not null,
  -- the promo page the candidate came from, shown to the admin for context
  source_url text not null,
  -- the raw line the scraper matched, so the admin can sanity-check the parse
  detected_text text,
  -- slugify(title)-year; the scraper upserts on (team_slug, dedupe_key) so a
  -- promo that keeps appearing across runs updates in place instead of piling
  -- up, and an already-reviewed draft is never resurrected to 'pending'
  dedupe_key text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  -- the community_bobbleheads.id created when a draft is approved
  approved_community_id text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (team_slug, dedupe_key)
);

-- Cheap lookups for the admin queue and the home-page badge, which both filter
-- to the pending rows.
create index if not exists scraped_giveaways_pending_idx
  on public.scraped_giveaways (status, first_seen_at);

alter table public.scraped_giveaways enable row level security;

-- Only the admin can see the queue. No insert policy — the scraper writes with
-- the service-role key, which bypasses RLS.
drop policy if exists "scraped_giveaways: admin select" on public.scraped_giveaways;
create policy "scraped_giveaways: admin select"
  on public.scraped_giveaways for select
  to authenticated
  using (public.is_admin());

-- The admin "dismiss" action updates status directly; "approve" goes through
-- the SECURITY DEFINER function below (which also needs to write the update).
drop policy if exists "scraped_giveaways: admin update" on public.scraped_giveaways;
create policy "scraped_giveaways: admin update"
  on public.scraped_giveaways for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Approve a drafted giveaway: promote it to a live community listing (the same
-- runtime path approve_submission() uses for a user-submitted new_bobblehead,
-- since the curated JSON set can't be added to at runtime) and mark the draft
-- approved. Runs as SECURITY DEFINER because community_bobbleheads has no admin
-- insert policy.
create or replace function public.approve_scraped_giveaway(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.scraped_giveaways%rowtype;
  v_new_id text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_row
    from public.scraped_giveaways
    where id = p_id and status = 'pending'
    for update;

  if not found then
    raise exception 'draft not found or already reviewed';
  end if;

  v_new_id := 'community-' || v_row.team_slug || '-' ||
    regexp_replace(lower(coalesce(v_row.title, 'bobblehead')), '[^a-z0-9]+', '-', 'g') ||
    '-' || substr(v_row.id::text, 1, 8);

  insert into public.community_bobbleheads (id, team_slug, title, year, date, image_url, approved_by, created_at)
  values (
    v_new_id,
    v_row.team_slug,
    coalesce(nullif(v_row.title, ''), 'Untitled'),
    coalesce(nullif(v_row.year, ''), 'Unknown'),
    coalesce(nullif(v_row.date, ''), 'N/A'),
    null,
    auth.uid(),
    now()
  );

  update public.scraped_giveaways
    set status = 'approved', reviewed_at = now(), approved_community_id = v_new_id
    where id = p_id;

  return v_new_id;
end;
$$;

revoke all on function public.approve_scraped_giveaway(uuid) from public, anon;
grant execute on function public.approve_scraped_giveaway(uuid) to authenticated;
