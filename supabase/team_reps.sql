-- Team reps: limited, team-scoped edit access.
-- Run this once in the Supabase SQL editor after schema.sql. Safe to re-run.
--
-- A rep is a trusted person who oversees exactly one team's page and may edit
-- only that team. This file adds the team_reps table and the can_edit_team()
-- check, then repoints every team-scoped edit path (RLS write policies + the
-- approve/reject/delete RPCs) from is_admin() to can_edit_team(team_slug), so
-- admins keep full access and reps are fenced to their own team. It also widens
-- the submission/report SELECT policies and the photo-bucket storage policies so
-- a rep can work their team's queue. These same changes are folded into
-- schema.sql for fresh setups; this file is the migration for an existing DB.

-- ---------------------------------------------------------------------------
-- Table + core checks
-- ---------------------------------------------------------------------------
create table if not exists public.team_reps (
  email text not null,
  team_slug text not null,
  created_at timestamptz not null default now(),
  primary key (email, team_slug)
);

alter table public.team_reps enable row level security;

create or replace function public.can_edit_team(p_team_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.team_reps
    where email = coalesce(auth.jwt() ->> 'email', '')
      and team_slug = p_team_slug
  );
$$;

-- True for a rep of any team. Widens the photo-bucket storage policies only:
-- storage objects sit at random UUID paths with no team_slug, so they can't be
-- scoped per team the way the DB rows can. The team-scoped gate stays on the DB
-- rows that reference a file; an unreferenced upload is a harmless orphan.
create or replace function public.is_team_rep()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_reps
    where email = coalesce(auth.jwt() ->> 'email', '')
  );
$$;

create or replace function public.my_editable_teams()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select team_slug from public.team_reps
  where email = coalesce(auth.jwt() ->> 'email', '');
$$;

grant execute on function public.can_edit_team(text) to anon, authenticated;
grant execute on function public.is_team_rep() to anon, authenticated;
grant execute on function public.my_editable_teams() to authenticated;

-- ---------------------------------------------------------------------------
-- Rep management (admin-only)
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_team_reps()
returns table (email text, team_slug text, created_at timestamptz)
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
  select r.email, r.team_slug, r.created_at
  from public.team_reps r
  order by r.team_slug, r.email;
end;
$$;

create or replace function public.admin_assign_team_rep(p_email text, p_team_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if v_email = '' or trim(coalesce(p_team_slug, '')) = '' then
    raise exception 'email and team are required';
  end if;

  if not exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'no account exists for %; have them create a Bobble Shelf account first', v_email;
  end if;

  insert into public.team_reps (email, team_slug)
  values (v_email, trim(p_team_slug))
  on conflict (email, team_slug) do nothing;
end;
$$;

create or replace function public.admin_remove_team_rep(p_email text, p_team_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.team_reps
  where email = lower(trim(coalesce(p_email, '')))
    and team_slug = trim(coalesce(p_team_slug, ''));
end;
$$;

revoke all on function public.admin_list_team_reps() from public, anon;
revoke all on function public.admin_assign_team_rep(text, text) from public, anon;
revoke all on function public.admin_remove_team_rep(text, text) from public, anon;
grant execute on function public.admin_list_team_reps() to authenticated;
grant execute on function public.admin_assign_team_rep(text, text) to authenticated;
grant execute on function public.admin_remove_team_rep(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Repoint team-scoped write policies: is_admin() -> can_edit_team(team_slug)
-- ---------------------------------------------------------------------------
drop policy if exists "approved_photos: admin insert" on public.approved_photos;
create policy "approved_photos: admin insert"
  on public.approved_photos for insert
  to authenticated
  with check (public.can_edit_team(team_slug));

drop policy if exists "approved_photos: admin update" on public.approved_photos;
create policy "approved_photos: admin update"
  on public.approved_photos for update
  to authenticated
  using (public.can_edit_team(team_slug))
  with check (public.can_edit_team(team_slug));

drop policy if exists "approved_photos: admin delete" on public.approved_photos;
create policy "approved_photos: admin delete"
  on public.approved_photos for delete
  to authenticated
  using (public.can_edit_team(team_slug));

drop policy if exists "community_bobbleheads: admin update" on public.community_bobbleheads;
create policy "community_bobbleheads: admin update"
  on public.community_bobbleheads for update
  to authenticated
  using (public.can_edit_team(team_slug))
  with check (public.can_edit_team(team_slug));

drop policy if exists "bobblehead_gallery_photos: admin delete" on public.bobblehead_gallery_photos;
create policy "bobblehead_gallery_photos: admin delete"
  on public.bobblehead_gallery_photos for delete
  to authenticated
  using (public.can_edit_team(team_slug));

drop policy if exists "bobblehead_gallery_photos: admin insert" on public.bobblehead_gallery_photos;
create policy "bobblehead_gallery_photos: admin insert"
  on public.bobblehead_gallery_photos for insert
  to authenticated
  with check (public.can_edit_team(team_slug));

drop policy if exists "bobblehead_overrides: admin insert" on public.bobblehead_overrides;
create policy "bobblehead_overrides: admin insert"
  on public.bobblehead_overrides for insert
  to authenticated
  with check (public.can_edit_team(team_slug));

drop policy if exists "bobblehead_overrides: admin update" on public.bobblehead_overrides;
create policy "bobblehead_overrides: admin update"
  on public.bobblehead_overrides for update
  to authenticated
  using (public.can_edit_team(team_slug))
  with check (public.can_edit_team(team_slug));

-- Widen the queue SELECT policies + report resolution so a rep works their team.
drop policy if exists "submissions: submitter or admin select" on public.submissions;
create policy "submissions: submitter or admin select"
  on public.submissions for select
  to authenticated
  using (auth.uid() = submitted_by or public.can_edit_team(team_slug));

drop policy if exists "listing_reports: submitter or admin select" on public.listing_reports;
create policy "listing_reports: submitter or admin select"
  on public.listing_reports for select
  to authenticated
  using (auth.uid() = submitted_by or public.can_edit_team(team_slug));

drop policy if exists "listing_reports: admin update" on public.listing_reports;
create policy "listing_reports: admin update"
  on public.listing_reports for update
  to authenticated
  using (public.can_edit_team(team_slug))
  with check (public.can_edit_team(team_slug));

-- ---------------------------------------------------------------------------
-- Repoint the team-scoped RPCs
-- ---------------------------------------------------------------------------
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
  select * into v_submission
    from public.submissions
    where id = p_submission_id and status = 'pending'
    for update;

  if not found then
    raise exception 'submission not found or already reviewed';
  end if;

  if not public.can_edit_team(v_submission.team_slug) then
    raise exception 'not authorized';
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

    insert into public.community_bobbleheads (id, team_slug, title, nickname, year, date, image_url, approved_by, created_at)
    values (
      v_new_id,
      v_submission.team_slug,
      coalesce(v_submission.title, 'Untitled'),
      v_submission.nickname,
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
declare
  v_team_slug text;
begin
  select team_slug into v_team_slug
    from public.submissions
    where id = p_submission_id and status = 'pending'
    for update;

  if not found then
    raise exception 'submission not found or already reviewed';
  end if;

  if not public.can_edit_team(v_team_slug) then
    raise exception 'not authorized';
  end if;

  update public.submissions
    set status = 'rejected', reviewed_at = now()
    where id = p_submission_id;
end;
$$;

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
  if not public.can_edit_team(p_team_slug) then
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

-- ---------------------------------------------------------------------------
-- Widen photo-bucket storage policies to include reps (see is_team_rep note)
-- ---------------------------------------------------------------------------
drop policy if exists "pending: owner or admin can view" on storage.objects;
create policy "pending: owner or admin can view"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bobblehead-pending'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin() or public.is_team_rep())
  );

drop policy if exists "pending: admin can delete" on storage.objects;
create policy "pending: admin can delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'bobblehead-pending' and (public.is_admin() or public.is_team_rep()));

drop policy if exists "approved: admin can upload" on storage.objects;
create policy "approved: admin can upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'bobblehead-approved' and (public.is_admin() or public.is_team_rep()));

drop policy if exists "approved: admin can delete" on storage.objects;
create policy "approved: admin can delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'bobblehead-approved' and (public.is_admin() or public.is_team_rep()));
