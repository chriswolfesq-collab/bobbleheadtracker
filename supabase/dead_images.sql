-- Dead-image sweep queue. Run once in the Supabase SQL editor; safe to re-run.
--
-- A nightly Vercel Cron job (app/api/dead-image-sweep) crawls every image URL
-- the site can display — the curated seed URLs in data/giveaways/*.json plus
-- the admin/community/gallery photos in the DB — and records the broken ones
-- here for the admin to work through at /admin/dead-images. Rows auto-heal:
-- when a host restores an image (or an admin swaps the URL) the next sweep
-- flips the row to 'resolved'.
--
-- The sweep writes with the service-role key, which bypasses RLS, so there is
-- deliberately NO insert policy below. Reads and the admin "mark fixed" update
-- are gated to admin-mode accounts via public.is_admin(), exactly like
-- listing_reports.

create table if not exists public.dead_images (
  id uuid primary key default gen_random_uuid(),
  -- which source the URL came from
  source text not null check (source in ('curated', 'approved_photo', 'community', 'gallery')),
  -- whether the underlying listing is curated or community — drives the
  -- admin queue's link back to the listing page
  listing_kind text not null check (listing_kind in ('curated', 'community')),
  team_slug text not null,
  bobblehead_id text not null,
  title text,
  image_url text not null,
  http_status int,             -- null = network error / timeout (see `error`)
  error text,                  -- short reason: 'timeout' | 'network' | 'http_404' | ...
  status text not null default 'open' check (status in ('open', 'resolved')),
  first_seen_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- one row per (source, listing, url); the sweep upserts on this key so a URL
  -- that stays broken updates in place rather than piling up duplicates
  unique (source, team_slug, bobblehead_id, image_url)
);

-- Cheap lookups for the admin queue and the home-page badge count, which both
-- filter to the open rows.
create index if not exists dead_images_open_idx
  on public.dead_images (status, first_seen_at);

alter table public.dead_images enable row level security;

-- dead_images: only the admin can see and resolve the queue. No insert policy —
-- the nightly sweep writes with the service-role key, which bypasses RLS.
drop policy if exists "dead_images: admin select" on public.dead_images;
create policy "dead_images: admin select"
  on public.dead_images for select
  to authenticated
  using (public.is_admin());

drop policy if exists "dead_images: admin update" on public.dead_images;
create policy "dead_images: admin update"
  on public.dead_images for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
