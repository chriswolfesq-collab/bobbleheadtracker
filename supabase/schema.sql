-- Bobblehead tracker schema.
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Safe to re-run: uses `if not exists` / `on conflict do nothing` throughout.

-- ---------------------------------------------------------------------------
-- Admin check
-- ---------------------------------------------------------------------------
-- Single source of truth for "is this request the site admin". Update the
-- email here if the admin account ever changes; every policy/function below
-- calls this instead of repeating the literal address.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'chriswolfesq@gmail.com';
$$;

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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.user_collections enable row level security;
alter table public.approved_photos enable row level security;
alter table public.community_bobbleheads enable row level security;
alter table public.submissions enable row level security;

-- user_collections: fully private per-user data.
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

-- approved_photos / community_bobbleheads: public read, writes only via the
-- SECURITY DEFINER approve_submission() function below (or the SQL editor,
-- which runs as postgres and bypasses RLS).
drop policy if exists "approved_photos: public read" on public.approved_photos;
create policy "approved_photos: public read"
  on public.approved_photos for select
  to anon, authenticated
  using (true);

drop policy if exists "community_bobbleheads: public read" on public.community_bobbleheads;
create policy "community_bobbleheads: public read"
  on public.community_bobbleheads for select
  to anon, authenticated
  using (true);

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

-- ---------------------------------------------------------------------------
-- Approval / rejection RPCs
-- ---------------------------------------------------------------------------
-- Storage can't be touched from SQL, so the client copies the file from the
-- pending bucket to the approved bucket first (see lib/admin.ts), then calls
-- this function with the resulting public URL to do the DB bookkeeping
-- atomically. Both functions re-check admin status server-side, so a client
-- that lies about being the admin still gets rejected.

create or replace function public.approve_submission(p_submission_id uuid, p_image_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions%rowtype;
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

    insert into public.approved_photos (bobblehead_id, team_slug, image_url, approved_by, updated_at)
    values (v_submission.target_bobblehead_id, v_submission.team_slug, p_image_url, auth.uid(), now())
    on conflict (bobblehead_id) do update
      set image_url = excluded.image_url,
          approved_by = excluded.approved_by,
          updated_at = now();

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

revoke all on function public.approve_submission(uuid, text) from public, anon;
revoke all on function public.reject_submission(uuid) from public, anon;
grant execute on function public.approve_submission(uuid, text) to authenticated;
grant execute on function public.reject_submission(uuid) to authenticated;

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
