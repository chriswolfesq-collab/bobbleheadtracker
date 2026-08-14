-- Description edit requests: any signed-in member can propose a rewrite of a
-- listing's "About This Bobblehead" text; the team's rep (or the admin) rules
-- on it from /admin/edit-requests. Approving stores the text on the listing —
-- the Wikipedia move: the crowd drafts, the curators publish.
--
-- Until now the About text had no storage at all: the seed `story` field in
-- data/giveaways/*.json is empty everywhere, so every page shows a computed
-- fallback sentence. Part 1 gives the text a real home on the same rows every
-- other edit lands on — bobblehead_overrides for curated listings and
-- community_bobbleheads for community ones — which is deliberate: both tables
-- already have revalidate triggers (supabase/revalidate_trigger.sql), so an
-- approved description busts the prerender cache with no new plumbing. A new
-- side table would have needed its own trigger or gone stale forever.
--
-- The queue itself is a hybrid of two existing shapes: tag_requests' table
-- (pending-unique index, BB429 rate limit, own-or-reviewer read) with
-- listing_reports' team scoping — can_edit_team() instead of is_admin() — so
-- a rep can accept edits for their own team without waiting on the admin.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- Part 1: give descriptions a home on the listing rows
-- ---------------------------------------------------------------------------

alter table public.bobblehead_overrides add column if not exists description text;
alter table public.community_bobbleheads add column if not exists description text;

alter table public.bobblehead_overrides drop constraint if exists bobblehead_overrides_description_len;
alter table public.bobblehead_overrides
  add constraint bobblehead_overrides_description_len
  check (description is null or char_length(description) <= 2000);

alter table public.community_bobbleheads drop constraint if exists community_bobbleheads_description_len;
alter table public.community_bobbleheads
  add constraint community_bobbleheads_description_len
  check (description is null or char_length(description) <= 2000);

-- ---------------------------------------------------------------------------
-- Part 2: the request queue
-- ---------------------------------------------------------------------------
-- One row per ask. source is 'curated' | 'community' because the two kinds of
-- listing live at different URLs and approval writes to different tables —
-- same reason tag_requests and listing_reports carry it.

create table if not exists public.description_edit_requests (
  id uuid primary key default gen_random_uuid(),
  bobblehead_id text not null,
  team_slug text not null,
  source text not null default 'curated' check (source in ('curated', 'community')),
  proposed text not null check (char_length(btrim(proposed)) between 10 and 2000),
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Asking twice for the same listing is a revision, not a second request — but
-- the index can't merge them, so the second insert fails and the client shows
-- "you already have one pending". Scoped to pending so a rejected suggestion
-- doesn't bar a better one later.
create unique index if not exists description_edit_requests_pending_unique
  on public.description_edit_requests (bobblehead_id, team_slug, requested_by)
  where status = 'pending';

create index if not exists description_edit_requests_status_idx
  on public.description_edit_requests (status);
create index if not exists description_edit_requests_requested_by_idx
  on public.description_edit_requests (requested_by);

alter table public.description_edit_requests enable row level security;

-- Any signed-in member can propose, on any listing — writing a better blurb
-- doesn't require being the team's rep; the review is what gates publishing.
-- Not anon: a proposal has to be attributable, to rate-limit it and to show
-- the proposer their pending chip.
drop policy if exists "description_edit_requests: insert own" on public.description_edit_requests;
create policy "description_edit_requests: insert own"
  on public.description_edit_requests for insert
  to authenticated
  with check (requested_by = (select auth.uid()) and status = 'pending');

-- The proposer sees their own (the listing page shows "pending review"); the
-- team's editors see their queue. can_edit_team folds in is_admin, so the
-- admin sees everything — and the same head count that gives the admin the
-- site-wide badge number gives a rep their team's.
drop policy if exists "description_edit_requests: own or editor read" on public.description_edit_requests;
create policy "description_edit_requests: own or editor read"
  on public.description_edit_requests for select
  to authenticated
  using (requested_by = (select auth.uid()) or public.can_edit_team(team_slug));

-- Ruling belongs to whoever can edit the listing itself — rep for their team,
-- admin for all. Unlike tag_requests (admin-only, protecting one site-wide
-- vocabulary), a description belongs to one team's page.
drop policy if exists "description_edit_requests: editor update" on public.description_edit_requests;
create policy "description_edit_requests: editor update"
  on public.description_edit_requests for update
  to authenticated
  using (public.can_edit_team(team_slug))
  with check (public.can_edit_team(team_slug));

drop policy if exists "description_edit_requests: editor delete" on public.description_edit_requests;
create policy "description_edit_requests: editor delete"
  on public.description_edit_requests for delete
  to authenticated
  using (public.can_edit_team(team_slug));

-- A public write path gets the standard throttle: BEFORE INSERT, SECURITY
-- DEFINER so the count sees every row past the select policy, SQLSTATE BB429
-- so lib/rateLimit.ts swaps in friendly copy. Same thresholds as tag requests
-- — a paragraph is cheap to write and cheap to spam.
create or replace function public.enforce_description_edit_rate_limit()
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
  from public.description_edit_requests
  where requested_by = new.requested_by
    and created_at > now() - interval '1 hour';

  select count(*) into v_last_day
  from public.description_edit_requests
  where requested_by = new.requested_by
    and created_at > now() - interval '24 hours';

  if v_last_hour >= 10 or v_last_day >= 50 then
    raise exception 'You''re suggesting edits too quickly. Please wait a bit and try again.'
      using errcode = 'BB429';
  end if;

  return new;
end;
$$;

drop trigger if exists rate_limit_description_edits on public.description_edit_requests;
create trigger rate_limit_description_edits
  before insert on public.description_edit_requests
  for each row
  execute function public.enforce_description_edit_rate_limit();
