-- Profile photos.
--
-- The image lives in a new public `avatars` storage bucket; the database
-- carries only the object's path (`<user-id>/<uuid>.jpg`). The client writes
-- that path into auth user_metadata — the same write path display_name uses,
-- because profiles has no update policy by design — and the existing
-- sync_profile_from_auth trigger mirrors it into profiles.avatar_path, where
-- the forum's read RPCs join it out for other people's posts.
--
-- A path rather than a URL, and validated against `<own-user-id>/<filename>`:
-- user_metadata is client-writable free text, so a full URL stored there could
-- point anywhere and would end up rendered into <img> tags shown to other
-- moderators. A path that must start with your own user id can only ever name
-- a file the storage policies let you upload. (Google OAuth also drops its own
-- `avatar_url` into user_metadata — a googleusercontent URL — which is another
-- reason the key here is avatar_path and not avatar_url.)
--
-- Needs: awards.sql (sync_profile_from_auth and the member-number sequence)
-- and mod_forum.sql (the forum read RPCs recreated in Part 3).

-- ---------------------------------------------------------------------------
-- Part 1: the mirrored column
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists avatar_path text;

-- Recreated in full from awards.sql to add the avatar mirror, matching how
-- later files recreate wants_email — the current version of this function now
-- lives here. The insert guard and sequence reasoning are explained where the
-- function was born (awards.sql); only the update gained a line.
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = new.id) then
    insert into public.profiles (id, display_name, member_number)
    values (
      new.id,
      public.display_name_of(new.raw_user_meta_data),
      nextval('public.profiles_member_number_seq')
    )
    on conflict (id) do nothing;
  end if;

  update public.profiles
     set display_name = public.display_name_of(new.raw_user_meta_data),
         avatar_path = case
           when new.raw_user_meta_data ->> 'avatar_path'
                ~ ('^' || new.id::text || '/[A-Za-z0-9._-]+$')
           then new.raw_user_meta_data ->> 'avatar_path'
           else null
         end,
         updated_at = now()
   where id = new.id;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Part 2: the bucket
-- ---------------------------------------------------------------------------
-- Its own bucket for the same reason pending/approved are split: the public
-- flag is per bucket, and neither existing bucket has the right write policy —
-- approved is admin-only and pending isn't public. The upsert (rather than
-- `do nothing`) keeps the size cap and mime allow-list current on re-runs.
--
-- The client downscales every photo to a 256px JPEG before upload, so the
-- 1 MiB cap is a backstop against someone talking to the API directly, not a
-- limit any real upload should meet.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Same `<user-id>/<file>` ownership trick as the pending bucket. Anyone can
-- *download* an avatar — the bucket is public, and downloads through the
-- public URL never consult these policies — so select here only exists to let
-- the owner list their own folder and sweep out replaced files.

drop policy if exists "avatars: owner can upload" on storage.objects;
create policy "avatars: owner can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: owner can list" on storage.objects;
create policy "avatars: owner can list"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: owner can delete" on storage.objects;
create policy "avatars: owner can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Part 3: avatars on the Team Rep Forum
-- ---------------------------------------------------------------------------
-- The three read RPCs gain the author's current avatar, joined live from
-- profiles. Unlike author_name — stamped at write time so a thread outlives a
-- deleted account — the photo is joined fresh on every read: it's cosmetic,
-- and someone who changes their picture expects their old posts to follow.
-- A deleted account's join comes back null and the byline falls back to
-- initials, so nothing is lost when the row outlives the profile.
--
-- Dropped and recreated rather than replaced: Postgres refuses to change a
-- function's return type in place. The current version of all three now lives
-- here, not in mod_forum.sql. `create function` grants execute to public by
-- default, so the revoke/grant pairs below are load-bearing, not ceremony.

drop function if exists public.forum_list_topics();
create function public.forum_list_topics()
returns table (
  id uuid,
  title text,
  body text,
  author_id uuid,
  author_name text,
  author_avatar_path text,
  team_slug text,
  pinned boolean,
  locked boolean,
  reply_count int,
  last_activity_at timestamptz,
  created_at timestamptz,
  edited_at timestamptz,
  unread boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.title,
    t.body,
    t.author_id,
    t.author_name,
    p.avatar_path,
    t.team_slug,
    t.pinned,
    t.locked,
    t.reply_count,
    t.last_activity_at,
    t.created_at,
    t.edited_at,
    coalesce(fr.read_at, '-infinity'::timestamptz) < t.last_activity_at
  from public.forum_topics t
  left join public.profiles p on p.id = t.author_id
  left join public.forum_reads fr
    on fr.topic_id = t.id and fr.user_id = auth.uid()
  where public.is_moderator()
  order by t.pinned desc, t.last_activity_at desc;
$$;

drop function if exists public.forum_get_topic(uuid);
create function public.forum_get_topic(p_id uuid)
returns table (
  id uuid,
  title text,
  body text,
  author_id uuid,
  author_name text,
  author_avatar_path text,
  team_slug text,
  pinned boolean,
  locked boolean,
  reply_count int,
  last_activity_at timestamptz,
  created_at timestamptz,
  edited_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id, t.title, t.body, t.author_id, t.author_name, p.avatar_path,
    t.team_slug, t.pinned, t.locked, t.reply_count, t.last_activity_at,
    t.created_at, t.edited_at
  from public.forum_topics t
  left join public.profiles p on p.id = t.author_id
  where t.id = p_id and public.is_moderator();
$$;

drop function if exists public.forum_list_replies(uuid);
create function public.forum_list_replies(p_topic_id uuid)
returns table (
  id uuid,
  topic_id uuid,
  body text,
  author_id uuid,
  author_name text,
  author_avatar_path text,
  created_at timestamptz,
  edited_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.topic_id, r.body, r.author_id, r.author_name, p.avatar_path,
         r.created_at, r.edited_at
  from public.forum_replies r
  left join public.profiles p on p.id = r.author_id
  where r.topic_id = p_topic_id and public.is_moderator()
  order by r.created_at;
$$;

revoke all on function public.forum_list_topics() from public, anon;
revoke all on function public.forum_get_topic(uuid) from public, anon;
revoke all on function public.forum_list_replies(uuid) from public, anon;

grant execute on function public.forum_list_topics() to authenticated;
grant execute on function public.forum_get_topic(uuid) to authenticated;
grant execute on function public.forum_list_replies(uuid) to authenticated;
