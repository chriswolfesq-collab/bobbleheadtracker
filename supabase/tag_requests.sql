-- Tag requests: the vocabulary is admin-curated now. Reps used to mint and
-- apply tags themselves ("tags: editor insert" in tags.sql), which is how the
-- duplicate-tags queue filled up — this replaces that direct write with a
-- request the admin approves or rejects from /admin/tag-requests. Idempotent —
-- safe to run more than once. Paste into the Supabase SQL editor.

-- 1. The queue. One row per (listing, proposed tag, requester). label/slug are
--    validated to the same shape as tags itself so an approval can't fail the
--    vocabulary's checks. source is 'curated' | 'community', because the two
--    kinds of listing live at different URLs and the review page needs to link
--    to the right one — same reason listing_reports carries it.
create table if not exists public.tag_requests (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  slug text not null,
  bobblehead_id text not null,
  team_slug text not null,
  source text not null default 'curated' check (source in ('curated', 'community')),
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.tag_requests drop constraint if exists tag_requests_slug_shape_check;
alter table public.tag_requests
  add constraint tag_requests_slug_shape_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40);

alter table public.tag_requests drop constraint if exists tag_requests_label_check;
alter table public.tag_requests
  add constraint tag_requests_label_check
  check (char_length(btrim(label)) between 2 and 40);

-- Asking twice for the same tag on the same listing is a double-click, not two
-- requests. Scoped to pending so a rejected request can be re-asked later if
-- the admin changes their mind about the vocabulary.
create unique index if not exists tag_requests_pending_unique
  on public.tag_requests (bobblehead_id, slug, requested_by)
  where status = 'pending';

-- The review page reads the pending queue; everything else is by requester.
create index if not exists tag_requests_status_idx on public.tag_requests (status);
create index if not exists tag_requests_requested_by_idx on public.tag_requests (requested_by);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.tag_requests enable row level security;

-- Requesting is for the people who could previously tag directly: a rep, on
-- their own team's listings. can_edit_team is true for admins too, which is
-- harmless — an admin's picker writes to tags directly and never comes here.
drop policy if exists "tag_requests: editor insert own" on public.tag_requests;
create policy "tag_requests: editor insert own"
  on public.tag_requests for insert
  to authenticated
  with check (requested_by = (select auth.uid()) and public.can_edit_team(team_slug));

-- A requester sees their own (the listing page shows "pending review"); the
-- admin sees the whole queue.
drop policy if exists "tag_requests: own or admin read" on public.tag_requests;
create policy "tag_requests: own or admin read"
  on public.tag_requests for select
  to authenticated
  using (requested_by = (select auth.uid()) or public.is_admin());

-- Ruling on a request is the admin's alone.
drop policy if exists "tag_requests: admin update" on public.tag_requests;
create policy "tag_requests: admin update"
  on public.tag_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "tag_requests: admin delete" on public.tag_requests;
create policy "tag_requests: admin delete"
  on public.tag_requests for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Tighten the tag tables themselves: adds and removals are admin-only now.
-- These replace the editor policies created in tags.sql.
-- ---------------------------------------------------------------------------

drop policy if exists "tags: editor insert" on public.tags;
drop policy if exists "tags: admin insert" on public.tags;
create policy "tags: admin insert"
  on public.tags for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "bobblehead_tags: editor insert" on public.bobblehead_tags;
drop policy if exists "bobblehead_tags: admin insert" on public.bobblehead_tags;
create policy "bobblehead_tags: admin insert"
  on public.bobblehead_tags for insert
  to authenticated
  with check (public.is_admin());

-- Removal too: a rep who could strip an approved tag could undo the review
-- this table exists for.
drop policy if exists "bobblehead_tags: editor delete" on public.bobblehead_tags;
drop policy if exists "bobblehead_tags: admin delete" on public.bobblehead_tags;
create policy "bobblehead_tags: admin delete"
  on public.bobblehead_tags for delete
  to authenticated
  using (public.is_admin());
