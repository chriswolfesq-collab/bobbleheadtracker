-- Images on Team Rep Forum posts.
--
-- One optional image per topic and per reply, attached when the post is
-- written. The file lives in a new PRIVATE `forum-images` bucket — the board
-- itself is private, so its pictures can't be the one part of a thread anyone
-- on the internet can fetch. Reads go through short-lived signed URLs the
-- client mints against its own moderator session.
--
-- The post row stores only the object path (`<user-id>/<uuid>.jpg`), the same
-- shape avatars use (see avatars.sql): the write RPCs refuse a path outside
-- the caller's own folder, so a post can't be pointed at somebody else's file
-- or anywhere else. Unlike the author's avatar (joined live), the image is
-- part of what was said — it stays with the post.
--
-- Needs: mod_forum.sql, then avatars.sql (this file recreates the read RPCs
-- *including* the author_avatar_path column avatars.sql added — the current
-- version of every recreated function now lives here).

-- ---------------------------------------------------------------------------
-- Part 1: the columns
-- ---------------------------------------------------------------------------

alter table public.forum_topics
  add column if not exists image_path text;

alter table public.forum_replies
  add column if not exists image_path text;

-- ---------------------------------------------------------------------------
-- Part 2: the bucket
-- ---------------------------------------------------------------------------
-- Private, unlike avatars: a public bucket serves to anyone with the URL, and
-- forum screenshots are exactly the kind of thing that shouldn't leak past
-- the board. 5 MiB is a backstop — the client re-encodes to a bounded JPEG
-- before upload, same trick as avatars but at content size (1600px) rather
-- than thumbnail size.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forum-images', 'forum-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Upload into your own folder, moderators only. Reading is any moderator —
-- that's what lets every board member mint a signed URL for anyone's image.
-- Delete is any moderator rather than just the owner, because an admin can
-- delete someone else's post and the file should be sweepable with it.

drop policy if exists "forum-images: moderator can upload" on storage.objects;
create policy "forum-images: moderator can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'forum-images'
    and public.is_moderator()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "forum-images: moderator can view" on storage.objects;
create policy "forum-images: moderator can view"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'forum-images' and public.is_moderator());

drop policy if exists "forum-images: moderator can delete" on storage.objects;
create policy "forum-images: moderator can delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'forum-images' and public.is_moderator());

-- ---------------------------------------------------------------------------
-- Part 3: writing
-- ---------------------------------------------------------------------------
-- Dropped by their old signatures rather than replaced: `create or replace`
-- with a new argument would leave both versions installed, and PostgREST
-- refuses an ambiguous RPC name. Bodies are mod_forum.sql's with the image
-- added; the reasoning comments live there.

drop function if exists public.forum_create_topic(text, text, text);
create function public.forum_create_topic(
  p_title text,
  p_body text,
  p_team_slug text default null,
  p_image_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author record;
  v_title text := trim(coalesce(p_title, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_image text := nullif(trim(coalesce(p_image_path, '')), '');
  v_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'not authorized';
  end if;

  if length(v_title) < 3 or length(v_title) > 140 then
    raise exception 'A title needs to be between 3 and 140 characters.';
  end if;

  if length(v_body) < 1 or length(v_body) > 8000 then
    raise exception 'A post needs to be between 1 and 8000 characters.';
  end if;

  if v_image is not null and v_image !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'That image isn''t one you uploaded.';
  end if;

  select * into v_author from public.forum_author();

  insert into public.forum_topics (title, body, author_id, author_email, author_name, team_slug, image_path)
  values (
    v_title,
    v_body,
    v_author.user_id,
    v_author.email,
    v_author.name,
    nullif(trim(coalesce(p_team_slug, '')), ''),
    v_image
  )
  returning id into v_id;

  insert into public.forum_reads (user_id, topic_id, read_at)
  values (v_author.user_id, v_id, now())
  on conflict (user_id, topic_id) do update set read_at = now();

  return v_id;
end;
$$;

drop function if exists public.forum_reply(uuid, text);
create function public.forum_reply(p_topic_id uuid, p_body text, p_image_path text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author record;
  v_body text := trim(coalesce(p_body, ''));
  v_image text := nullif(trim(coalesce(p_image_path, '')), '');
  v_locked boolean;
  v_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'not authorized';
  end if;

  if length(v_body) < 1 or length(v_body) > 8000 then
    raise exception 'A reply needs to be between 1 and 8000 characters.';
  end if;

  if v_image is not null and v_image !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'That image isn''t one you uploaded.';
  end if;

  select locked into v_locked from public.forum_topics where id = p_topic_id;

  if not found then
    raise exception 'that topic no longer exists';
  end if;

  if v_locked then
    raise exception 'that topic is locked';
  end if;

  select * into v_author from public.forum_author();

  insert into public.forum_replies (topic_id, body, author_id, author_email, author_name, image_path)
  values (p_topic_id, v_body, v_author.user_id, v_author.email, v_author.name, v_image)
  returning id into v_id;

  insert into public.forum_reads (user_id, topic_id, read_at)
  values (v_author.user_id, p_topic_id, now())
  on conflict (user_id, topic_id) do update set read_at = now();

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Part 4: deleting
-- ---------------------------------------------------------------------------
-- Same authorization as before; the change is the return value. SQL can delete
-- the rows but not the storage objects behind them, so each delete hands back
-- the orphaned image paths for the client to sweep (best effort — the
-- moderator delete policy above is what lets an admin remove another author's
-- file). A missed sweep leaks an unreachable file, nothing more.

drop function if exists public.forum_delete_topic(uuid);
create function public.forum_delete_topic(p_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_paths text[];
begin
  select author_id into v_author_id from public.forum_topics where id = p_id;

  if not found then
    raise exception 'that topic no longer exists';
  end if;

  if not (public.is_admin() or v_author_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  -- Collected before the delete: the reply rows cascade away with the topic.
  select coalesce(array_agg(image_path), '{}') into v_paths
  from (
    select image_path from public.forum_topics where id = p_id and image_path is not null
    union all
    select image_path from public.forum_replies where topic_id = p_id and image_path is not null
  ) images;

  delete from public.forum_topics where id = p_id;

  return v_paths;
end;
$$;

drop function if exists public.forum_delete_reply(uuid);
create function public.forum_delete_reply(p_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_paths text[];
begin
  select author_id into v_author_id from public.forum_replies where id = p_id;

  if not found then
    raise exception 'that reply no longer exists';
  end if;

  if not (public.is_admin() or v_author_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  select coalesce(array_agg(image_path), '{}') into v_paths
  from public.forum_replies where id = p_id and image_path is not null;

  delete from public.forum_replies where id = p_id;

  return v_paths;
end;
$$;

-- ---------------------------------------------------------------------------
-- Part 5: reading
-- ---------------------------------------------------------------------------
-- The read RPCs, recreated once more with image_path (and still carrying
-- avatars.sql's author_avatar_path). Return-type changes force the
-- drop-and-recreate, which is also why the grants are repeated below.

drop function if exists public.forum_list_topics();
create function public.forum_list_topics()
returns table (
  id uuid,
  title text,
  body text,
  image_path text,
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
    t.image_path,
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
  image_path text,
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
    t.id, t.title, t.body, t.image_path, t.author_id, t.author_name,
    p.avatar_path, t.team_slug, t.pinned, t.locked, t.reply_count,
    t.last_activity_at, t.created_at, t.edited_at
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
  image_path text,
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
  select r.id, r.topic_id, r.body, r.image_path, r.author_id, r.author_name,
         p.avatar_path, r.created_at, r.edited_at
  from public.forum_replies r
  left join public.profiles p on p.id = r.author_id
  where r.topic_id = p_topic_id and public.is_moderator()
  order by r.created_at;
$$;

-- ---------------------------------------------------------------------------
-- Grants for everything dropped above
-- ---------------------------------------------------------------------------

revoke all on function public.forum_create_topic(text, text, text, text) from public, anon;
revoke all on function public.forum_reply(uuid, text, text) from public, anon;
revoke all on function public.forum_delete_topic(uuid) from public, anon;
revoke all on function public.forum_delete_reply(uuid) from public, anon;
revoke all on function public.forum_list_topics() from public, anon;
revoke all on function public.forum_get_topic(uuid) from public, anon;
revoke all on function public.forum_list_replies(uuid) from public, anon;

grant execute on function public.forum_create_topic(text, text, text, text) to authenticated;
grant execute on function public.forum_reply(uuid, text, text) to authenticated;
grant execute on function public.forum_delete_topic(uuid) to authenticated;
grant execute on function public.forum_delete_reply(uuid) to authenticated;
grant execute on function public.forum_list_topics() to authenticated;
grant execute on function public.forum_get_topic(uuid) to authenticated;
grant execute on function public.forum_list_replies(uuid) to authenticated;
