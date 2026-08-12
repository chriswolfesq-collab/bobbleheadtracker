-- The moderators' forum: a private, threaded discussion board for admins and
-- team reps. Run once in the Supabase SQL editor after rep_activity.sql and
-- weekly_digest.sql; safe to re-run.
--
-- Why a forum and not a chatroom: reps are scattered across thirty teams and
-- are almost never on the site at the same moment. A live room would scroll
-- past unread and leave nothing to find later; threads wait for the person
-- they're addressed to and stay searchable afterwards. It is also why the
-- notification is a digest rather than a per-message ping.
--
-- Everything a moderator can see, every moderator can see: one shared space,
-- no per-team walls. Cross-team coordination ("this promo ran in two cities",
-- "how are you tagging these?") is the reason the board exists, and a rep who
-- can only see their own team's threads gets none of that. `team_slug` on a
-- topic is a label for filtering, not a permission.
--
-- Writes go through SECURITY DEFINER RPCs rather than INSERT/UPDATE policies.
-- RLS can gate a row but not a column, and several columns here must not be
-- author-writable (pinned, locked, reply_count, author_email). Funnelling every
-- write through a function puts the authorship stamp, the rate limit and the
-- thread bookkeeping in one place instead of spreading them across policies and
-- triggers that each have to agree.

-- ---------------------------------------------------------------------------
-- Who counts as a moderator
-- ---------------------------------------------------------------------------
-- The whole file gates on this one predicate: a full admin, or a rep of any
-- team. Deliberately not team-scoped -- see the header. Defined here rather
-- than in team_reps.sql because that file is about team-scoped *edit* rights,
-- and this is a different question with the same inputs.
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_team_rep();
$$;

grant execute on function public.is_moderator() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The tables
-- ---------------------------------------------------------------------------
create table if not exists public.forum_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  author_id uuid references auth.users (id) on delete set null,
  -- Denormalized for the same reason rep_activity denormalizes its actor: a
  -- thread outlives the account that started it, and a deleted account must not
  -- turn a year of discussion into rows signed by nobody.
  author_email text,
  author_name text,
  -- Which team the thread is about, when it's about one. A label the composer
  -- offers, not a permission -- every moderator sees every topic regardless.
  team_slug text,
  -- Pinned topics sort above the rest. Admin-only, so the board rules and the
  -- "read me first" thread can't be pushed off the top by traffic.
  pinned boolean not null default false,
  -- A locked thread is still readable but takes no new replies. For a decision
  -- that's been made, not for punishment.
  locked boolean not null default false,
  -- Maintained by the trigger below, not by whoever is replying. Denormalized
  -- because the topic list needs both on every row and a correlated count over
  -- a growing replies table is the one query on this page that would not scale.
  reply_count int not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.forum_topics (id) on delete cascade,
  body text not null,
  author_id uuid references auth.users (id) on delete set null,
  author_email text,
  author_name text,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

-- Per-person read marks. One row per moderator per topic they've opened; the
-- absence of a row means never read. Compared against the topic's
-- last_activity_at, so a new reply makes a topic unread again for everyone who
-- isn't the person who wrote it.
create table if not exists public.forum_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references public.forum_topics (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

-- The list page's sort, and the digest's window, are both this.
create index if not exists forum_topics_activity_idx
  on public.forum_topics (last_activity_at desc);

-- A thread view reads its replies in order; without this it's a scan of every
-- reply on the board.
create index if not exists forum_replies_topic_idx
  on public.forum_replies (topic_id, created_at);

alter table public.forum_topics enable row level security;
alter table public.forum_replies enable row level security;
alter table public.forum_reads enable row level security;

-- ---------------------------------------------------------------------------
-- Policies: read-only, and only for moderators
-- ---------------------------------------------------------------------------
-- No insert/update/delete policy on topics or replies anywhere in this file.
-- The RPCs below are the only way to write, which is what keeps pinned, locked
-- and the reply counts out of a client's reach.
drop policy if exists "forum_topics: moderator select" on public.forum_topics;
create policy "forum_topics: moderator select"
  on public.forum_topics for select
  to authenticated
  using (public.is_moderator());

drop policy if exists "forum_replies: moderator select" on public.forum_replies;
create policy "forum_replies: moderator select"
  on public.forum_replies for select
  to authenticated
  using (public.is_moderator());

-- Read marks are private: yours are yours. Nobody needs to know who has opened
-- a thread, and a board where that's visible is a board people post less on.
drop policy if exists "forum_reads: own select" on public.forum_reads;
create policy "forum_reads: own select"
  on public.forum_reads for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Thread bookkeeping
-- ---------------------------------------------------------------------------
-- reply_count and last_activity_at are derived, so a trigger owns them. Doing
-- this in forum_reply() instead would leave both wrong the moment a reply is
-- deleted, and "unread" is computed from last_activity_at.
create or replace function public.sync_forum_topic_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.forum_topics
      set reply_count = reply_count + 1,
          last_activity_at = greatest(last_activity_at, new.created_at)
      where id = new.topic_id;
    return new;
  end if;

  -- Deleting the newest reply walks last_activity_at back to whatever is now
  -- newest, so a thread doesn't keep floating at the top of the list on the
  -- strength of a post that no longer exists.
  update public.forum_topics t
    set reply_count = greatest(t.reply_count - 1, 0),
        last_activity_at = greatest(
          t.created_at,
          coalesce(
            (select max(r.created_at) from public.forum_replies r
              where r.topic_id = t.id and r.id <> old.id),
            t.created_at
          )
        )
    where t.id = old.topic_id;
  return old;
end;
$$;

drop trigger if exists sync_forum_activity_on_reply on public.forum_replies;
create trigger sync_forum_activity_on_reply
  after insert or delete on public.forum_replies
  for each row
  execute function public.sync_forum_topic_activity();

-- ---------------------------------------------------------------------------
-- Who am I, for the authorship stamp
-- ---------------------------------------------------------------------------
-- Every write RPC starts here: it authorizes and resolves the display name in
-- one place, so a post can't be attributed to anyone but its author and the
-- name shown is the one the person actually goes by on the site.
create or replace function public.forum_author()
returns table (user_id uuid, email text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.email,
    coalesce(
      nullif(p.display_name, 'Member'),
      u.raw_user_meta_data ->> 'display_name',
      split_part(u.email, '@', 1)
    )
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = auth.uid();
$$;

revoke all on function public.forum_author() from public, anon;
grant execute on function public.forum_author() to authenticated;

-- ---------------------------------------------------------------------------
-- Rate limit
-- ---------------------------------------------------------------------------
-- Same shape and SQLSTATE as enforce_inbound_message_rate_limit, so
-- lib/rateLimit.ts already recognizes the refusal. Generous on purpose: this is
-- a dozen trusted people, and the only thing being stopped is a stuck submit
-- button or a paste loop. Counted across both tables, since a burst is a burst
-- whether it lands as topics or replies.
create or replace function public.enforce_forum_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent int;
begin
  select
    (select count(*) from public.forum_topics
      where author_id = new.author_id and created_at > now() - interval '1 hour')
    + (select count(*) from public.forum_replies
      where author_id = new.author_id and created_at > now() - interval '1 hour')
  into v_recent;

  if v_recent >= 40 then
    raise exception 'That''s a lot of posting in one hour. Take a breather and try again shortly.'
      using errcode = 'BB429';
  end if;

  return new;
end;
$$;

drop trigger if exists rate_limit_forum_topics on public.forum_topics;
create trigger rate_limit_forum_topics
  before insert on public.forum_topics
  for each row
  execute function public.enforce_forum_rate_limit();

drop trigger if exists rate_limit_forum_replies on public.forum_replies;
create trigger rate_limit_forum_replies
  before insert on public.forum_replies
  for each row
  execute function public.enforce_forum_rate_limit();

-- ---------------------------------------------------------------------------
-- Writing
-- ---------------------------------------------------------------------------
create or replace function public.forum_create_topic(
  p_title text,
  p_body text,
  p_team_slug text default null
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

  select * into v_author from public.forum_author();

  insert into public.forum_topics (title, body, author_id, author_email, author_name, team_slug)
  values (
    v_title,
    v_body,
    v_author.user_id,
    v_author.email,
    v_author.name,
    nullif(trim(coalesce(p_team_slug, '')), '')
  )
  returning id into v_id;

  -- You've read what you just wrote. Without this the author's own topic comes
  -- back unread on the next load, and the unread badge stops meaning anything.
  insert into public.forum_reads (user_id, topic_id, read_at)
  values (v_author.user_id, v_id, now())
  on conflict (user_id, topic_id) do update set read_at = now();

  return v_id;
end;
$$;

create or replace function public.forum_reply(p_topic_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author record;
  v_body text := trim(coalesce(p_body, ''));
  v_locked boolean;
  v_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'not authorized';
  end if;

  if length(v_body) < 1 or length(v_body) > 8000 then
    raise exception 'A reply needs to be between 1 and 8000 characters.';
  end if;

  select locked into v_locked from public.forum_topics where id = p_topic_id;

  if not found then
    raise exception 'that topic no longer exists';
  end if;

  if v_locked then
    raise exception 'that topic is locked';
  end if;

  select * into v_author from public.forum_author();

  insert into public.forum_replies (topic_id, body, author_id, author_email, author_name)
  values (p_topic_id, v_body, v_author.user_id, v_author.email, v_author.name)
  returning id into v_id;

  insert into public.forum_reads (user_id, topic_id, read_at)
  values (v_author.user_id, p_topic_id, now())
  on conflict (user_id, topic_id) do update set read_at = now();

  return v_id;
end;
$$;

-- Editing is the author's own post, or an admin's for anyone's. Typos and
-- corrections; edited_at is set so a silently rewritten post is visible as one.
create or replace function public.forum_edit_topic(p_id uuid, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_body text := trim(coalesce(p_body, ''));
begin
  select author_id into v_author_id from public.forum_topics where id = p_id;

  if not found then
    raise exception 'that topic no longer exists';
  end if;

  if not (public.is_admin() or v_author_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  if length(v_title) < 3 or length(v_title) > 140 then
    raise exception 'A title needs to be between 3 and 140 characters.';
  end if;

  if length(v_body) < 1 or length(v_body) > 8000 then
    raise exception 'A post needs to be between 1 and 8000 characters.';
  end if;

  update public.forum_topics
    set title = v_title, body = v_body, edited_at = now()
    where id = p_id;
end;
$$;

create or replace function public.forum_edit_reply(p_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_body text := trim(coalesce(p_body, ''));
begin
  select author_id into v_author_id from public.forum_replies where id = p_id;

  if not found then
    raise exception 'that reply no longer exists';
  end if;

  if not (public.is_admin() or v_author_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  if length(v_body) < 1 or length(v_body) > 8000 then
    raise exception 'A reply needs to be between 1 and 8000 characters.';
  end if;

  update public.forum_replies
    set body = v_body, edited_at = now()
    where id = p_id;
end;
$$;

-- Deleting a topic takes its replies with it (the FK cascades). Other people's
-- words go with it, so this is the author's own thread or an admin's call.
create or replace function public.forum_delete_topic(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
begin
  select author_id into v_author_id from public.forum_topics where id = p_id;

  if not found then
    raise exception 'that topic no longer exists';
  end if;

  if not (public.is_admin() or v_author_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  delete from public.forum_topics where id = p_id;
end;
$$;

create or replace function public.forum_delete_reply(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
begin
  select author_id into v_author_id from public.forum_replies where id = p_id;

  if not found then
    raise exception 'that reply no longer exists';
  end if;

  if not (public.is_admin() or v_author_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  delete from public.forum_replies where id = p_id;
end;
$$;

-- Pin and lock are admin-only: they change the board for everyone, not one
-- thread's contents.
create or replace function public.forum_set_pinned(p_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.forum_topics set pinned = coalesce(p_pinned, false) where id = p_id;

  if not found then
    raise exception 'that topic no longer exists';
  end if;
end;
$$;

create or replace function public.forum_set_locked(p_id uuid, p_locked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.forum_topics set locked = coalesce(p_locked, false) where id = p_id;

  if not found then
    raise exception 'that topic no longer exists';
  end if;
end;
$$;

-- Called when a thread is opened. Stamped with now() rather than the topic's
-- last_activity_at so a reply that lands while the thread is on screen still
-- counts as read -- you are looking at it.
create or replace function public.forum_mark_read(p_topic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'not authorized';
  end if;

  insert into public.forum_reads (user_id, topic_id, read_at)
  values (auth.uid(), p_topic_id, now())
  on conflict (user_id, topic_id) do update set read_at = now();
end;
$$;

revoke all on function public.forum_create_topic(text, text, text) from public, anon;
revoke all on function public.forum_reply(uuid, text) from public, anon;
revoke all on function public.forum_edit_topic(uuid, text, text) from public, anon;
revoke all on function public.forum_edit_reply(uuid, text) from public, anon;
revoke all on function public.forum_delete_topic(uuid) from public, anon;
revoke all on function public.forum_delete_reply(uuid) from public, anon;
revoke all on function public.forum_set_pinned(uuid, boolean) from public, anon;
revoke all on function public.forum_set_locked(uuid, boolean) from public, anon;
revoke all on function public.forum_mark_read(uuid) from public, anon;

grant execute on function public.forum_create_topic(text, text, text) to authenticated;
grant execute on function public.forum_reply(uuid, text) to authenticated;
grant execute on function public.forum_edit_topic(uuid, text, text) to authenticated;
grant execute on function public.forum_edit_reply(uuid, text) to authenticated;
grant execute on function public.forum_delete_topic(uuid) to authenticated;
grant execute on function public.forum_delete_reply(uuid) to authenticated;
grant execute on function public.forum_set_pinned(uuid, boolean) to authenticated;
grant execute on function public.forum_set_locked(uuid, boolean) to authenticated;
grant execute on function public.forum_mark_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------
-- The list, with each caller's own unread flag folded in. An RPC rather than a
-- table select plus a second read of forum_reads, because the unread join is
-- the whole ordering story and doing it client-side means shipping every read
-- mark to the browser to compute a dot.
create or replace function public.forum_list_topics()
returns table (
  id uuid,
  title text,
  body text,
  author_id uuid,
  author_name text,
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
    t.team_slug,
    t.pinned,
    t.locked,
    t.reply_count,
    t.last_activity_at,
    t.created_at,
    t.edited_at,
    coalesce(fr.read_at, '-infinity'::timestamptz) < t.last_activity_at
  from public.forum_topics t
  left join public.forum_reads fr
    on fr.topic_id = t.id and fr.user_id = auth.uid()
  where public.is_moderator()
  order by t.pinned desc, t.last_activity_at desc;
$$;

create or replace function public.forum_get_topic(p_id uuid)
returns table (
  id uuid,
  title text,
  body text,
  author_id uuid,
  author_name text,
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
    t.id, t.title, t.body, t.author_id, t.author_name, t.team_slug,
    t.pinned, t.locked, t.reply_count, t.last_activity_at, t.created_at, t.edited_at
  from public.forum_topics t
  where t.id = p_id and public.is_moderator();
$$;

create or replace function public.forum_list_replies(p_topic_id uuid)
returns table (
  id uuid,
  topic_id uuid,
  body text,
  author_id uuid,
  author_name text,
  created_at timestamptz,
  edited_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.topic_id, r.body, r.author_id, r.author_name, r.created_at, r.edited_at
  from public.forum_replies r
  where r.topic_id = p_topic_id and public.is_moderator()
  order by r.created_at;
$$;

-- Just the number, for the badge on the admin dashboard. Its own function so
-- the dashboard doesn't fetch every topic to count the dots.
create or replace function public.forum_unread_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*), 0)::int
  from public.forum_topics t
  left join public.forum_reads fr
    on fr.topic_id = t.id and fr.user_id = auth.uid()
  where public.is_moderator()
    and coalesce(fr.read_at, '-infinity'::timestamptz) < t.last_activity_at;
$$;

revoke all on function public.forum_list_topics() from public, anon;
revoke all on function public.forum_get_topic(uuid) from public, anon;
revoke all on function public.forum_list_replies(uuid) from public, anon;
revoke all on function public.forum_unread_count() from public, anon;

grant execute on function public.forum_list_topics() to authenticated;
grant execute on function public.forum_get_topic(uuid) to authenticated;
grant execute on function public.forum_list_replies(uuid) to authenticated;
grant execute on function public.forum_unread_count() to authenticated;

-- ---------------------------------------------------------------------------
-- The email preference
-- ---------------------------------------------------------------------------
-- wants_email and set_email_preference are recreated in full rather than
-- patched, matching how weekly_digest.sql added its own kind: these two are the
-- single decision point every sender checks, so the current version of each
-- lives in whichever file added the newest kind.
alter table public.profiles
  add column if not exists email_forum_digest boolean not null default true;

create or replace function public.wants_email(p_user_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user_id is null then false
    else coalesce(
      (
        select p.email_enabled
           and case p_kind
                 when 'all' then true
                 when 'wanted_alerts' then p.email_wishlist_alerts
                 when 'submission_updates' then p.email_submission_updates
                 when 'rep_digest' then p.email_rep_digest
                 when 'weekly_digest' then p.email_weekly_digest
                 when 'forum_digest' then p.email_forum_digest
                 -- An unknown kind is a bug in the caller. Fail closed rather
                 -- than mailing on a preference nobody can turn off.
                 else false
               end
        from public.profiles p
        where p.id = p_user_id
      ),
      -- No profile row: honor the master default (on) for known kinds only.
      p_kind in ('all', 'wanted_alerts', 'submission_updates', 'rep_digest', 'weekly_digest', 'forum_digest')
    )
  end;
$$;

revoke all on function public.wants_email(uuid, text) from public, anon;
grant execute on function public.wants_email(uuid, text) to authenticated;

create or replace function public.set_email_preference(p_kind text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean := coalesce(p_enabled, true);
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_kind is null or p_kind not in
    ('all', 'wanted_alerts', 'submission_updates', 'rep_digest', 'weekly_digest', 'forum_digest') then
    raise exception 'unknown email preference: %', p_kind;
  end if;

  insert into public.profiles (id) values (auth.uid())
  on conflict (id) do nothing;

  update public.profiles set
    email_enabled =
      case when p_kind = 'all' then v_enabled else email_enabled end,
    email_wishlist_alerts =
      case when p_kind = 'wanted_alerts' then v_enabled else email_wishlist_alerts end,
    email_submission_updates =
      case when p_kind = 'submission_updates' then v_enabled else email_submission_updates end,
    email_rep_digest =
      case when p_kind = 'rep_digest' then v_enabled else email_rep_digest end,
    email_weekly_digest =
      case when p_kind = 'weekly_digest' then v_enabled else email_weekly_digest end,
    email_forum_digest =
      case when p_kind = 'forum_digest' then v_enabled else email_forum_digest end,
    updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.set_email_preference(text, boolean) from public, anon;
grant execute on function public.set_email_preference(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- The daily digest
-- ---------------------------------------------------------------------------
-- One email per moderator, listing the threads *they* haven't read. Unlike the
-- rep digest, which sends the same summary to every admin, this one is
-- per-recipient by necessity: "unread" is a different set for each person, and
-- a digest that lists threads you wrote and have already read is the kind of
-- mail people filter away.
--
-- Same division of labour as the other mailers: all the aggregation happens
-- here in SQL and the edge function is a dumb formatter with no database
-- access and no service-role key.
create extension if not exists pg_net with schema extensions;

-- The x-webhook-secret header reads from Vault via public.webhook_secret()
-- rather than carrying a literal. Run webhook_secret.sql once before this file.
create or replace function public.send_forum_digest(p_hours int default 24)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(hours => greatest(p_hours, 1));
  v_recipients jsonb;
  v_total int;
begin
  with active as (
    select t.*
    from public.forum_topics t
    where t.last_activity_at >= v_since
  ),
  -- Every moderator with an account, admins and reps alike, who hasn't turned
  -- this digest off. A rep named in team_reps who has never signed up has no
  -- user row and so gets nothing -- correct, since they also can't read the
  -- board yet.
  mods as (
    select u.id, u.email
    from auth.users u
    where (
        exists (select 1 from public.admins a where lower(a.email) = lower(u.email))
        or exists (select 1 from public.team_reps r where lower(r.email) = lower(u.email))
      )
      and public.wants_email(u.id, 'forum_digest')
  ),
  unread as (
    select
      m.id as user_id,
      m.email,
      a.id as topic_id,
      a.title,
      -- Who spoke last, and what they said: the newest post in the thread is
      -- what makes it unread, so that's the line worth putting in the email.
      coalesce(latest.author_name, a.author_name) as who,
      left(coalesce(latest.body, a.body), 240) as snippet,
      (select count(*)::int from public.forum_replies r
        where r.topic_id = a.id and r.created_at >= v_since) as new_replies,
      a.last_activity_at
    from mods m
    cross join active a
    left join public.forum_reads fr
      on fr.user_id = m.id and fr.topic_id = a.id
    left join lateral (
      select r.body, r.author_name
      from public.forum_replies r
      where r.topic_id = a.id
      order by r.created_at desc
      limit 1
    ) latest on true
    where coalesce(fr.read_at, '-infinity'::timestamptz) < a.last_activity_at
  )
  select
    coalesce(jsonb_agg(r), '[]'::jsonb),
    coalesce(sum(r.topic_count), 0)::int
  into v_recipients, v_total
  from (
    select
      u.email,
      count(*)::int as topic_count,
      jsonb_agg(
        jsonb_build_object(
          'id', u.topic_id,
          'title', u.title,
          'who', u.who,
          'snippet', u.snippet,
          'new_replies', u.new_replies
        )
        order by u.last_activity_at desc
      ) as topics
    from unread u
    group by u.email
  ) r;

  -- Nobody has anything unread: send nothing. A daily "you're all caught up"
  -- email is how a digest teaches people to ignore it.
  if v_total = 0 then
    return 0;
  end if;

  perform net.http_post(
    url := 'https://mawwzvnlihhsagatmolq.supabase.co/functions/v1/forum-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', public.webhook_secret()
    ),
    body := jsonb_build_object('recipients', v_recipients)
  );

  return v_total;
end;
$$;

revoke all on function public.send_forum_digest(int) from public, anon;
-- Admins can fire it by hand to check the wiring without waiting for the
-- schedule, same as send_rep_activity_digest.
grant execute on function public.send_forum_digest(int) to authenticated;

-- ---------------------------------------------------------------------------
-- The schedule
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;

-- 13:00 UTC is 9am US Eastern: a morning nudge about what came in overnight,
-- rather than another thing landing at the end of the day next to the rep
-- digest. Unschedule first -- cron.schedule on an existing name stacks a
-- second job rather than replacing it.
select cron.unschedule('forum-digest')
where exists (select 1 from cron.job where jobname = 'forum-digest');

select cron.schedule(
  'forum-digest',
  '0 13 * * *',
  $$select public.send_forum_digest(24)$$
);
