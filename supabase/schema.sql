-- Bobblehead tracker schema.
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Safe to re-run: uses `if not exists` / `on conflict do nothing` throughout.

-- ---------------------------------------------------------------------------
-- Admin check
-- ---------------------------------------------------------------------------
-- Admin mode is a list of approved emails, not a property of any particular
-- user's regular account, and it's reached through a separate login at
-- /admin (see lib/adminAuth.tsx / lib/supabaseAdmin.ts) that keeps its own
-- session independent from the regular site login — signing in as the same
-- email on the main site does not grant admin powers there. An email in this
-- table gets admin-mode powers everywhere is_admin() is checked once signed
-- in through /admin; every other account (including that same email signed
-- in via the regular site) is a plain user. RLS on this table has no
-- policies at all (default deny to anon/authenticated) so only SECURITY
-- DEFINER functions can read it.
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- SECURITY DEFINER so it can read public.admins despite that table having no
-- read policy for anon/authenticated — this is the only sanctioned way to
-- check admin-mode membership.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins where email = coalesce(auth.jwt() ->> 'email', '')
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Seed admin-mode accounts here. The email must already exist as a Supabase
-- Auth account — sign up for it once at /admin (its "Need admin credentials?
-- Sign up" link) — then add it below and re-run this file. Safe to re-run.
insert into public.admins (email) values ('chriswolfesq@gmail.com')
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.user_collections (
  user_id uuid not null references auth.users (id) on delete cascade,
  bobblehead_id text not null,
  team_slug text not null,
  owned boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, bobblehead_id)
);

create table if not exists public.user_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  bobblehead_id text not null,
  team_slug text not null,
  favorited boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, bobblehead_id)
);

create table if not exists public.user_wants (
  user_id uuid not null references auth.users (id) on delete cascade,
  bobblehead_id text not null,
  team_slug text not null,
  wanted boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, bobblehead_id)
);

-- The public face of an account, and the only user data a stranger can reach.
-- It exists because auth.users is unreachable by anon: a public shelf page has
-- to turn a URL slug into a name and a user id, and there was no path for that.
--
-- Nothing here is public until the user opts in. is_public defaults to false,
-- and slug stays null until they first enable sharing (see
-- enable_public_shelf), so an account that never opts in has no URL to find.
-- display_name is a mirror of auth.users.raw_user_meta_data ->> 'display_name',
-- kept current by the sync_profile_from_auth trigger, because anon can't read
-- auth.users to resolve it themselves.
--
-- The slug is deliberately NOT derived from display_name on read: it's minted
-- once and then frozen. Renaming yourself must not break links other people
-- have already posted, which is the whole point of the feature.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  slug text unique,
  display_name text not null default 'Member',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approved_photos (
  bobblehead_id text primary key,
  team_slug text not null,
  image_url text not null,
  approved_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_bobbleheads (
  id text primary key,
  team_slug text not null,
  title text not null,
  year text not null default 'Unknown',
  date text not null default 'N/A',
  image_url text,
  approved_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.bobblehead_gallery_photos (
  id uuid primary key default gen_random_uuid(),
  bobblehead_id text not null,
  team_slug text not null,
  image_url text not null,
  approved_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- Text-field overrides for curated bobbleheads, whose title/year/date live in
-- the hardcoded lib/bobbleheads.ts rather than a table. Community bobbleheads
-- don't need this — their title/year/date are already real columns on
-- community_bobbleheads. A null column here means "not overridden".
--
-- `deleted` is the tombstone for an admin-deleted curated listing: the row in
-- lib/bobbleheads.ts can't be removed from the database, so the site filters
-- out anything flagged here instead (see lib/bobbleheadOverrides.ts).
create table if not exists public.bobblehead_overrides (
  team_slug text not null,
  bobblehead_id text not null,
  title text,
  year text,
  date text,
  deleted boolean not null default false,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  primary key (team_slug, bobblehead_id)
);

alter table public.bobblehead_overrides
  add column if not exists deleted boolean not null default false;

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('photo_for_existing', 'new_bobblehead')),
  target_bobblehead_id text,
  team_slug text not null,
  title text,
  year text,
  date text,
  storage_path text not null,
  submitted_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  team_slug text not null,
  bobblehead_id text not null,
  source text not null check (source in ('curated', 'community')),
  title text not null,
  reason text not null check (reason in ('not_real', 'wrong_date', 'wrong_name', 'duplicate', 'other')),
  details text,
  submitted_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.listing_reports drop constraint if exists listing_reports_reason_check;
alter table public.listing_reports add constraint listing_reports_reason_check
  check (reason in ('not_real', 'wrong_date', 'wrong_name', 'duplicate', 'other'));

-- ---------------------------------------------------------------------------
-- User deletion safety
-- ---------------------------------------------------------------------------
-- These four columns were originally created with the default `references
-- auth.users (id)` behavior (ON DELETE NO ACTION), which would make
-- admin_delete_user() below fail with a foreign key violation for any user
-- who ever approved a submission or edited a listing. Switching them to
-- ON DELETE SET NULL lets the user be removed while leaving the
-- approved/edited content itself intact.
alter table public.approved_photos drop constraint if exists approved_photos_approved_by_fkey;
alter table public.approved_photos
  add constraint approved_photos_approved_by_fkey
  foreign key (approved_by) references auth.users (id) on delete set null;

alter table public.community_bobbleheads drop constraint if exists community_bobbleheads_approved_by_fkey;
alter table public.community_bobbleheads
  add constraint community_bobbleheads_approved_by_fkey
  foreign key (approved_by) references auth.users (id) on delete set null;

alter table public.bobblehead_gallery_photos drop constraint if exists bobblehead_gallery_photos_approved_by_fkey;
alter table public.bobblehead_gallery_photos
  add constraint bobblehead_gallery_photos_approved_by_fkey
  foreign key (approved_by) references auth.users (id) on delete set null;

alter table public.bobblehead_overrides drop constraint if exists bobblehead_overrides_updated_by_fkey;
alter table public.bobblehead_overrides
  add constraint bobblehead_overrides_updated_by_fkey
  foreign key (updated_by) references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_collections enable row level security;
alter table public.user_favorites enable row level security;
alter table public.user_wants enable row level security;
alter table public.approved_photos enable row level security;
alter table public.community_bobbleheads enable row level security;
alter table public.bobblehead_gallery_photos enable row level security;
alter table public.bobblehead_overrides enable row level security;
alter table public.submissions enable row level security;
alter table public.listing_reports enable row level security;

-- profiles: readable by its owner only. Note what is NOT here — there is no
-- anon select policy, so a stranger cannot read this table at all, not even to
-- list slugs. Public shelves are served exclusively by get_public_shelf(), a
-- SECURITY DEFINER function that takes a slug the caller already knows and
-- returns nothing but a name and per-team counts. That means the public surface
-- is one function's return shape rather than a table, and enumerating who has a
-- shelf isn't possible.
--
-- There is no owner update policy either: writes go through
-- enable_public_shelf() / disable_public_shelf(). If the client could update
-- this table directly it could set its own slug, letting anyone squat an
-- arbitrary URL or impersonate another collector's shelf address.
drop policy if exists "profiles: owner select" on public.profiles;
create policy "profiles: owner select"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- Additive admin read policy, same rationale as user_collections below.
drop policy if exists "profiles: admin select" on public.profiles;
create policy "profiles: admin select"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- user_collections: fully private per-user data. A public shelf does not change
-- this: get_public_shelf() reads the table as its owner (SECURITY DEFINER) and
-- returns only aggregate counts per team, never bobblehead_id rows. Which
-- specific bobbleheads someone owns stays private whether or not they share.
drop policy if exists "user_collections: owner select" on public.user_collections;
create policy "user_collections: owner select"
  on public.user_collections for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_collections: owner upsert" on public.user_collections;
create policy "user_collections: owner upsert"
  on public.user_collections for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_collections: owner update" on public.user_collections;
create policy "user_collections: owner update"
  on public.user_collections for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Additive read policy so an admin can view any user's collection from the
-- admin "view profile" page. Postgres OR-combines permissive policies, so this
-- widens select for admins without loosening the owner-only policy above.
drop policy if exists "user_collections: admin select" on public.user_collections;
create policy "user_collections: admin select"
  on public.user_collections for select
  to authenticated
  using (public.is_admin());

-- user_favorites: fully private per-user data, same shape as user_collections.
drop policy if exists "user_favorites: owner select" on public.user_favorites;
create policy "user_favorites: owner select"
  on public.user_favorites for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_favorites: owner upsert" on public.user_favorites;
create policy "user_favorites: owner upsert"
  on public.user_favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_favorites: owner update" on public.user_favorites;
create policy "user_favorites: owner update"
  on public.user_favorites for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Additive admin read policy, same rationale as user_collections above.
drop policy if exists "user_favorites: admin select" on public.user_favorites;
create policy "user_favorites: admin select"
  on public.user_favorites for select
  to authenticated
  using (public.is_admin());

-- user_wants: fully private per-user data, same shape as user_collections.
drop policy if exists "user_wants: owner select" on public.user_wants;
create policy "user_wants: owner select"
  on public.user_wants for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_wants: owner upsert" on public.user_wants;
create policy "user_wants: owner upsert"
  on public.user_wants for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_wants: owner update" on public.user_wants;
create policy "user_wants: owner update"
  on public.user_wants for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Additive admin read policy, same rationale as user_collections above.
drop policy if exists "user_wants: admin select" on public.user_wants;
create policy "user_wants: admin select"
  on public.user_wants for select
  to authenticated
  using (public.is_admin());

-- approved_photos / community_bobbleheads / bobblehead_gallery_photos: public
-- read. Writes normally happen only via the SECURITY DEFINER
-- approve_submission() function below (or the SQL editor, which runs as
-- postgres and bypasses RLS), except where an admin-only write policy is
-- added explicitly (approved_photos, community_bobbleheads, and
-- bobblehead_overrides below) to support the admin's direct-edit UI.
drop policy if exists "approved_photos: public read" on public.approved_photos;
create policy "approved_photos: public read"
  on public.approved_photos for select
  to anon, authenticated
  using (true);

drop policy if exists "approved_photos: admin insert" on public.approved_photos;
create policy "approved_photos: admin insert"
  on public.approved_photos for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "approved_photos: admin update" on public.approved_photos;
create policy "approved_photos: admin update"
  on public.approved_photos for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Lets the admin remove just the main photo (the listing falls back to its
-- curated seed image or the team placeholder) without deleting the listing.
drop policy if exists "approved_photos: admin delete" on public.approved_photos;
create policy "approved_photos: admin delete"
  on public.approved_photos for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "community_bobbleheads: public read" on public.community_bobbleheads;
create policy "community_bobbleheads: public read"
  on public.community_bobbleheads for select
  to anon, authenticated
  using (true);

drop policy if exists "community_bobbleheads: admin update" on public.community_bobbleheads;
create policy "community_bobbleheads: admin update"
  on public.community_bobbleheads for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "bobblehead_gallery_photos: public read" on public.bobblehead_gallery_photos;
create policy "bobblehead_gallery_photos: public read"
  on public.bobblehead_gallery_photos for select
  to anon, authenticated
  using (true);

-- Lets the admin remove a single bad gallery photo without reaching for
-- admin_delete_bobblehead (which removes the whole listing).
drop policy if exists "bobblehead_gallery_photos: admin delete" on public.bobblehead_gallery_photos;
create policy "bobblehead_gallery_photos: admin delete"
  on public.bobblehead_gallery_photos for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "bobblehead_overrides: public read" on public.bobblehead_overrides;
create policy "bobblehead_overrides: public read"
  on public.bobblehead_overrides for select
  to anon, authenticated
  using (true);

drop policy if exists "bobblehead_overrides: admin insert" on public.bobblehead_overrides;
create policy "bobblehead_overrides: admin insert"
  on public.bobblehead_overrides for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "bobblehead_overrides: admin update" on public.bobblehead_overrides;
create policy "bobblehead_overrides: admin update"
  on public.bobblehead_overrides for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- submissions: anyone logged in can create their own; they can see their own,
-- the admin can see everything. Status changes only happen via the RPC
-- functions below.
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

-- listing_reports: anyone logged in can report a listing and see their own
-- reports; only the admin can see and resolve/dismiss the full queue.
drop policy if exists "listing_reports: submitter insert" on public.listing_reports;
create policy "listing_reports: submitter insert"
  on public.listing_reports for insert
  to authenticated
  with check (auth.uid() = submitted_by);

drop policy if exists "listing_reports: submitter or admin select" on public.listing_reports;
create policy "listing_reports: submitter or admin select"
  on public.listing_reports for select
  to authenticated
  using (auth.uid() = submitted_by or public.is_admin());

drop policy if exists "listing_reports: admin update" on public.listing_reports;
create policy "listing_reports: admin update"
  on public.listing_reports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Approval / rejection RPCs
-- ---------------------------------------------------------------------------
-- Storage can't be touched from SQL, so the client copies the file from the
-- pending bucket to the approved bucket first (see app/admin/review/page.tsx),
-- then calls this function with the resulting public URL to do the DB
-- bookkeeping atomically. Both functions re-check admin status server-side, so
-- a client that lies about being the admin still gets rejected.
--
-- A photo_for_existing submission becomes the bobblehead's main/profile photo
-- (approved_photos) when the bobblehead has no photo yet, and a gallery
-- addition when it already has one. Whether one exists is decided here, inside
-- the transaction, so two back-to-back approvals can't both think they're
-- first. The one source the database can't see is the curated seed photo
-- baked into the site's build-time data (lib/bobbleheads.ts) — the client
-- passes that single static fact as p_curated_has_photo.

drop function if exists public.approve_submission(uuid, text);
drop function if exists public.approve_submission(uuid, text, boolean);

create or replace function public.approve_submission(
  p_submission_id uuid,
  p_image_url text,
  p_curated_has_photo boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions%rowtype;
  v_has_existing_photo boolean;
  v_new_id text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_submission
    from public.submissions
    where id = p_submission_id and status = 'pending'
    for update;

  if not found then
    raise exception 'submission not found or already reviewed';
  end if;

  if v_submission.kind = 'photo_for_existing' then
    if v_submission.target_bobblehead_id is null then
      raise exception 'missing target_bobblehead_id for photo_for_existing submission';
    end if;

    v_has_existing_photo := p_curated_has_photo
      or exists (
        select 1 from public.approved_photos ap
          where ap.bobblehead_id = v_submission.target_bobblehead_id
      )
      or exists (
        select 1 from public.community_bobbleheads cb
          where cb.id = v_submission.target_bobblehead_id and cb.image_url is not null
      );

    if v_has_existing_photo then
      insert into public.bobblehead_gallery_photos (bobblehead_id, team_slug, image_url, approved_by)
      values (v_submission.target_bobblehead_id, v_submission.team_slug, p_image_url, auth.uid());
    else
      insert into public.approved_photos (bobblehead_id, team_slug, image_url, approved_by, updated_at)
      values (v_submission.target_bobblehead_id, v_submission.team_slug, p_image_url, auth.uid(), now())
      on conflict (bobblehead_id) do update
        set image_url = excluded.image_url,
            approved_by = excluded.approved_by,
            updated_at = now();
    end if;

  elsif v_submission.kind = 'new_bobblehead' then
    v_new_id := 'community-' || v_submission.team_slug || '-' ||
      regexp_replace(lower(coalesce(v_submission.title, 'bobblehead')), '[^a-z0-9]+', '-', 'g') ||
      '-' || substr(v_submission.id::text, 1, 8);

    insert into public.community_bobbleheads (id, team_slug, title, year, date, image_url, approved_by, created_at)
    values (
      v_new_id,
      v_submission.team_slug,
      coalesce(v_submission.title, 'Untitled'),
      coalesce(v_submission.year, 'Unknown'),
      coalesce(v_submission.date, 'N/A'),
      p_image_url,
      auth.uid(),
      now()
    );
  else
    raise exception 'unknown submission kind %', v_submission.kind;
  end if;

  update public.submissions
    set status = 'approved', reviewed_at = now()
    where id = p_submission_id;
end;
$$;

create or replace function public.reject_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.submissions
    set status = 'rejected', reviewed_at = now()
    where id = p_submission_id and status = 'pending';

  if not found then
    raise exception 'submission not found or already reviewed';
  end if;
end;
$$;

revoke all on function public.approve_submission(uuid, text, boolean) from public, anon;
revoke all on function public.reject_submission(uuid) from public, anon;
grant execute on function public.approve_submission(uuid, text, boolean) to authenticated;
grant execute on function public.reject_submission(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: delete a listing
-- ---------------------------------------------------------------------------
-- Removes a bobblehead and everything hanging off it (photos, gallery,
-- ownership, favorites) in one transaction. A community listing is a real row
-- and is deleted outright; a curated one lives in the hardcoded
-- lib/bobbleheads.ts, so it gets a `deleted` tombstone in bobblehead_overrides
-- that the site filters on instead. Pending submissions pointing at the
-- listing are rejected rather than deleted, so they stay visible in the
-- submitter's own history.

create or replace function public.admin_delete_bobblehead(
  p_team_slug text,
  p_bobblehead_id text,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if p_source not in ('curated', 'community') then
    raise exception 'unknown source %', p_source;
  end if;

  if p_source = 'community' then
    delete from public.community_bobbleheads
      where id = p_bobblehead_id and team_slug = p_team_slug;

    if not found then
      raise exception 'bobblehead not found';
    end if;

    delete from public.bobblehead_overrides
      where team_slug = p_team_slug and bobblehead_id = p_bobblehead_id;
  else
    insert into public.bobblehead_overrides (team_slug, bobblehead_id, deleted, updated_by, updated_at)
    values (p_team_slug, p_bobblehead_id, true, auth.uid(), now())
    on conflict (team_slug, bobblehead_id) do update
      set deleted = true,
          updated_by = auth.uid(),
          updated_at = now();
  end if;

  delete from public.approved_photos
    where bobblehead_id = p_bobblehead_id and team_slug = p_team_slug;
  delete from public.bobblehead_gallery_photos
    where bobblehead_id = p_bobblehead_id and team_slug = p_team_slug;
  delete from public.user_collections
    where bobblehead_id = p_bobblehead_id and team_slug = p_team_slug;
  delete from public.user_favorites
    where bobblehead_id = p_bobblehead_id and team_slug = p_team_slug;
  delete from public.user_wants
    where bobblehead_id = p_bobblehead_id and team_slug = p_team_slug;
  delete from public.listing_reports
    where bobblehead_id = p_bobblehead_id and team_slug = p_team_slug;

  update public.submissions
    set status = 'rejected', reviewed_at = now()
    where target_bobblehead_id = p_bobblehead_id
      and team_slug = p_team_slug
      and status = 'pending';
end;
$$;

revoke all on function public.admin_delete_bobblehead(text, text, text) from public, anon;
grant execute on function public.admin_delete_bobblehead(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: user management
-- ---------------------------------------------------------------------------
-- Driving the Auth Admin API would need a Supabase service-role key. The site
-- is server-rendered, so one could technically be held now, but we deliberately
-- don't: a service-role key bypasses RLS entirely, so every route holding it
-- becomes a place where a missing check leaks the whole table. Instead these
-- SECURITY DEFINER functions do the same job as approve_submission /
-- reject_submission above: they run with the privileges of the function owner
-- (which can read/write the auth schema), but re-check is_admin() themselves
-- first, so a non-admin caller gets 'not authorized' regardless of what the
-- client claims. Authorization stays in one place — this file — rather than
-- being spread across application code.

drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  owned_count int,
  favorite_count int,
  wanted_count int,
  submission_count int,
  report_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
    u.created_at,
    u.last_sign_in_at,
    (select count(*) from public.user_collections uc where uc.user_id = u.id and uc.owned)::int,
    (select count(*) from public.user_favorites uf where uf.user_id = u.id and uf.favorited)::int,
    (select count(*) from public.user_wants uw where uw.user_id = u.id and uw.wanted)::int,
    (select count(*) from public.submissions s where s.submitted_by = u.id)::int,
    (select count(*) from public.listing_reports lr where lr.submitted_by = u.id)::int
  from auth.users u
  order by u.created_at desc;
end;
$$;

-- Single-user version of admin_list_users, for the admin "view profile" page
-- reached directly by URL (where the list isn't loaded).
create or replace function public.admin_get_user(p_user_id uuid)
returns table (
  id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  where u.id = p_user_id;
end;
$$;

create or replace function public.admin_update_display_name(p_user_id uuid, p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if trim(coalesce(p_display_name, '')) = '' then
    raise exception 'display name is required';
  end if;

  update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', trim(p_display_name))
    where id = p_user_id;

  if not found then
    raise exception 'user not found';
  end if;
end;
$$;

-- Blocks deleting the account currently signed in to admin mode (rather than
-- just any admin account) so an admin can never lock themselves out mid-session.
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'cannot remove the account you are currently signed in as';
  end if;

  delete from auth.users where id = p_user_id;

  if not found then
    raise exception 'user not found';
  end if;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_get_user(uuid) from public, anon;
revoke all on function public.admin_update_display_name(uuid, text) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_get_user(uuid) to authenticated;
grant execute on function public.admin_update_display_name(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Public shelves
-- ---------------------------------------------------------------------------
-- Backs /shelf/<slug>: a page a collector can post publicly, showing their
-- per-team counts. Sharing is opt-in and off by default (see public.profiles).

-- The SQL mirror of getDisplayName() in lib/auth.tsx. Kept in sync by hand —
-- if the fallback chain changes there, change it here, or a shared shelf will
-- show a different name than the site does.
create or replace function public.display_name_of(p_meta jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(p_meta ->> 'display_name'), ''),
    nullif(trim(p_meta ->> 'full_name'), ''),
    nullif(trim(p_meta ->> 'name'), ''),
    'Member'
  );
$$;

-- Display name to URL segment. Anything that isn't a-z0-9 becomes a dash, so
-- a name that survives none of that (all emoji, all non-Latin script) falls
-- back to 'collector' and leans on the uniqueness suffix to tell them apart.
-- Capped at 40 chars to keep shared links readable.
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from left(
        trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g')),
        40
      )),
      ''
    ),
    'collector'
  );
$$;

-- Mirrors auth.users.raw_user_meta_data into profiles.display_name. anon can't
-- read auth.users, so without this copy a public shelf has no name to show.
-- Fires for both paths that touch the name: the user editing it themselves via
-- supabase.auth.updateUser, and admin_update_display_name() above — both write
-- raw_user_meta_data, so one trigger covers both.
--
-- Note this only syncs the name, never the slug: the slug is minted once in
-- enable_public_shelf() and then frozen, so renaming yourself doesn't break
-- links other people have already posted.
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, public.display_name_of(new.raw_user_meta_data))
  on conflict (id) do update
    set display_name = excluded.display_name,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists sync_profile_from_auth on auth.users;
create trigger sync_profile_from_auth
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth();

-- Backfill accounts that predate the trigger. Safe to re-run.
insert into public.profiles (id, display_name)
select u.id, public.display_name_of(u.raw_user_meta_data)
from auth.users u
on conflict (id) do nothing;

-- Turns sharing on and returns the shelf's slug, minting one on first call.
-- SECURITY DEFINER because profiles has no update policy: letting the client
-- write the table directly would let it choose its own slug and squat or
-- impersonate someone else's shelf URL.
create or replace function public.enable_public_shelf()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_slug text;
  v_base text;
  v_candidate text;
  v_suffix int := 2;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- Defensive: the trigger should have made this row at signup.
  insert into public.profiles (id, display_name)
  select v_user_id, public.display_name_of(u.raw_user_meta_data)
  from auth.users u
  where u.id = v_user_id
  on conflict (id) do nothing;

  select slug into v_slug from public.profiles where id = v_user_id;

  -- Only mint a slug the first time. Re-enabling after a disable reuses the
  -- existing one, so a link that worked before still works.
  if v_slug is null then
    select public.slugify(display_name) into v_base
    from public.profiles where id = v_user_id;

    v_candidate := v_base;
    while exists (select 1 from public.profiles where slug = v_candidate) loop
      v_candidate := v_base || '-' || v_suffix;
      v_suffix := v_suffix + 1;
    end loop;
    v_slug := v_candidate;
  end if;

  -- Two people with the same name enabling at the same instant can both pass
  -- the loop above and collide here; the unique index turns that into an error
  -- rather than a duplicate, and the retry picks the next suffix.
  update public.profiles
    set slug = v_slug,
        is_public = true,
        updated_at = now()
    where id = v_user_id;

  return v_slug;
end;
$$;

-- Deliberately keeps the slug: re-enabling later restores the same URL rather
-- than orphaning links that are already out in the world.
create or replace function public.disable_public_shelf()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles
    set is_public = false,
        updated_at = now()
    where id = auth.uid();
end;
$$;

-- The entire public read surface for shelves, and the only way anon reaches
-- user data anywhere in this schema. Takes a slug the caller already has (from
-- a shared link) and returns a name plus per-team counts — never bobblehead_id
-- rows, so what someone owns stays private even when their shelf is public.
-- Returns no rows for an unknown slug or an opted-out shelf, which the page
-- renders as a 404; there's no way to tell the two apart from outside, and no
-- way to enumerate who has a shelf.
create or replace function public.get_public_shelf(p_slug text)
returns table (display_name text, counts jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.display_name,
    coalesce(
      (
        select jsonb_object_agg(t.team_slug, t.cnt)
        from (
          select c.team_slug, count(*)::int as cnt
          from public.user_collections c
          where c.user_id = p.id and c.owned
          group by c.team_slug
        ) t
      ),
      '{}'::jsonb
    )
  from public.profiles p
  where p.slug = p_slug and p.is_public;
$$;

revoke all on function public.enable_public_shelf() from public, anon;
revoke all on function public.disable_public_shelf() from public, anon;
grant execute on function public.enable_public_shelf() to authenticated;
grant execute on function public.disable_public_shelf() to authenticated;
grant execute on function public.get_public_shelf(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
-- Two buckets rather than one bucket with two prefixes, because Supabase's
-- "public" flag (which controls unauthenticated read access) is set per
-- bucket, not per path.

insert into storage.buckets (id, name, public)
values ('bobblehead-pending', 'bobblehead-pending', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('bobblehead-approved', 'bobblehead-approved', true)
on conflict (id) do nothing;

-- Pending uploads live at `<user-id>/<filename>`, so the folder name doubles
-- as the ownership check.
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

drop policy if exists "pending: admin can delete" on storage.objects;
create policy "pending: admin can delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'bobblehead-pending' and public.is_admin());

drop policy if exists "approved: public can view" on storage.objects;
create policy "approved: public can view"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'bobblehead-approved');

drop policy if exists "approved: admin can upload" on storage.objects;
create policy "approved: admin can upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'bobblehead-approved' and public.is_admin());

-- Cleanup counterpart to the photo-delete policies above: when the admin
-- removes a main or gallery photo, the underlying file goes too.
drop policy if exists "approved: admin can delete" on storage.objects;
create policy "approved: admin can delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'bobblehead-approved' and public.is_admin());
