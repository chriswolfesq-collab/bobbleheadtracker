-- Team Rep Chatroom: one live room for admins and team reps, alongside the
-- threaded forum rather than replacing it.
--
-- mod_forum.sql's header argues against exactly this: reps are spread across
-- thirty teams, rarely online together, and a live room "would scroll past
-- unread and leave nothing to find later." That argument is why the forum
-- exists and why it stays the place for anything worth finding again. The room
-- is for the other half — the quick "is this listing a dupe?" that doesn't
-- deserve a thread. Two things keep the objection answered: the room carries an
-- unread count (chat_unread_count below) so a quiet rep learns they missed
-- something, and history is readable back through chat_list_messages' p_before
-- cursor rather than only being the last screenful.
--
-- Realtime: this is the first table in the project to join the
-- supabase_realtime publication (part 5). The client subscribes to inserts,
-- but the payload is deliberately NOT what gets rendered — an insert event is
-- only a nudge to call chat_new_messages(). That keeps one read path, keeps
-- the live profile join (a rep who changes their photo has it follow them onto
-- old lines, same as the forum), and means a dropped socket degrades to the
-- refetch-on-visibility the rest of the app already uses instead of silently
-- showing nothing.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL editor.
-- Needs: schema.sql, team_reps.sql, mod_forum.sql (is_moderator, forum_author),
-- avatars.sql (profiles.avatar_path).

-- ---------------------------------------------------------------------------
-- Part 1: the room
-- ---------------------------------------------------------------------------
-- author_name is stamped at write time, like the forum's: the room has to stay
-- readable after an account is deleted. author_id goes null in that case rather
-- than taking the message with it — losing one side of a conversation would
-- leave the other side answering nobody.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  author_id uuid references auth.users (id) on delete set null,
  author_name text,
  created_at timestamptz not null default now()
);

-- The room reads newest-first with a cursor; the rate limit counts one
-- author's recent rows on every insert. Chat is higher-frequency than anything
-- else here, so both get an index rather than a sequential scan per message.
create index if not exists chat_messages_created_at_idx
  on public.chat_messages (created_at desc);
create index if not exists chat_messages_author_recent_idx
  on public.chat_messages (author_id, created_at desc);

alter table public.chat_messages enable row level security;

-- Select-only, like the forum's tables: reads (and the realtime stream, which
-- applies this same policy to each subscriber) are open to moderators, and
-- every write goes through a security definer RPC below.
drop policy if exists "chat_messages: moderator select" on public.chat_messages;
create policy "chat_messages: moderator select"
  on public.chat_messages for select
  to authenticated
  using (public.is_moderator());

-- Where each reader left off, for the unread count. Same shape as forum_reads.
create table if not exists public.chat_reads (
  user_id uuid primary key references auth.users (id) on delete cascade,
  read_at timestamptz not null default now()
);

alter table public.chat_reads enable row level security;

drop policy if exists "chat_reads: own select" on public.chat_reads;
create policy "chat_reads: own select"
  on public.chat_reads for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Part 2: rate limit
-- ---------------------------------------------------------------------------
-- Its own trigger counting only its own rows: wiring chat into the forum's
-- enforce_forum_rate_limit would let a busy afternoon in the room lock a rep
-- out of the forum as collateral. 120/hour is two a minute sustained — well
-- past any real conversation between reps, and still a ceiling on a runaway
-- client. Deliberately the highest in the schema (photo votes sit at 60).

create or replace function public.enforce_chat_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent int;
begin
  select count(*) into v_recent
  from public.chat_messages
  where author_id = new.author_id
    and created_at > now() - interval '1 hour';

  if v_recent >= 120 then
    raise exception 'You''re sending messages faster than the room can take. Give it a minute.'
      using errcode = 'BB429';
  end if;

  return new;
end;
$$;

drop trigger if exists rate_limit_chat_messages on public.chat_messages;
create trigger rate_limit_chat_messages
  before insert on public.chat_messages
  for each row
  execute function public.enforce_chat_rate_limit();

-- ---------------------------------------------------------------------------
-- Part 3: reading
-- ---------------------------------------------------------------------------
-- Both readers return the same columns and join profiles live for the avatar,
-- so a message looks identical whether it arrived on first paint, through the
-- realtime nudge, or on a catch-up refetch.

create or replace function public.chat_list_messages(p_before timestamptz default null)
returns table (
  id uuid,
  body text,
  author_id uuid,
  author_name text,
  author_avatar_path text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  -- Newest 100 at or before the cursor, handed back oldest-first so the client
  -- can append straight to the bottom of the room.
  select * from (
    select m.id, m.body, m.author_id, m.author_name, p.avatar_path, m.created_at
    from public.chat_messages m
    left join public.profiles p on p.id = m.author_id
    where public.is_moderator()
      and (p_before is null or m.created_at < p_before)
    order by m.created_at desc
    limit 100
  ) recent
  order by created_at;
$$;

-- Everything since the caller's last known message. Called on a realtime
-- insert nudge and on tab-focus catch-up. Capped so a tab left open over a
-- weekend can't ask for the whole room in one go.
--
-- The window reaches back before the cursor on purpose. created_at defaults to
-- now(), which is TRANSACTION START time, and a row only becomes visible at
-- commit — so a slow send can land a message whose timestamp is older than one
-- a client has already caught up past. With a strict `> p_since` that message
-- is skipped, and skipped permanently: the cursor only ever moves forward, so
-- nothing asks for it again short of a reload. The overlap re-reads a few
-- seconds either side instead, and the client merges by id (lib/chat.ts), so
-- re-delivering a message it already holds costs one map write and changes
-- nothing on screen.
create or replace function public.chat_new_messages(p_since timestamptz)
returns table (
  id uuid,
  body text,
  author_id uuid,
  author_name text,
  author_avatar_path text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.body, m.author_id, m.author_name, p.avatar_path, m.created_at
  from public.chat_messages m
  left join public.profiles p on p.id = m.author_id
  where public.is_moderator()
    and m.created_at > p_since - interval '10 seconds'
  order by m.created_at
  limit 200;
$$;

-- Messages since this reader last had the room open. Drives the dashboard
-- badge, so a rep who was never in the room still learns they missed
-- something. Null read mark means "everything is new", capped the same way the
-- forum's unread count is bounded by its own topic list.
create or replace function public.chat_unread_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_moderator() then (
    select count(*)::int
    from public.chat_messages m
    where m.author_id is distinct from auth.uid()
      and m.created_at > coalesce(
        (select r.read_at from public.chat_reads r where r.user_id = auth.uid()),
        'epoch'::timestamptz
      )
  ) else 0 end;
$$;

-- ---------------------------------------------------------------------------
-- Part 4: writing
-- ---------------------------------------------------------------------------

-- Returns the stored row in the same shape the readers use, so the sender sees
-- their own message immediately even if the socket never delivers the echo.
create or replace function public.chat_send(p_body text)
returns table (
  id uuid,
  body text,
  author_id uuid,
  author_name text,
  author_avatar_path text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'The chatroom is for admins and team reps.';
  end if;

  if char_length(btrim(p_body)) = 0 then
    raise exception 'Nothing to send.';
  end if;

  -- Same resolution the forum stamps on a post, so one person reads the same
  -- in both places.
  select a.name into v_name from public.forum_author() a;

  insert into public.chat_messages (body, author_id, author_name)
  values (btrim(p_body), auth.uid(), v_name)
  returning chat_messages.id into v_id;

  return query
    select m.id, m.body, m.author_id, m.author_name, p.avatar_path, m.created_at
    from public.chat_messages m
    left join public.profiles p on p.id = m.author_id
    where m.id = v_id;
end;
$$;

-- Your own message, or anyone's if you're the admin. A rep can take back their
-- own typo without being able to edit the record of a disagreement.
create or replace function public.chat_delete_message(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.chat_messages
  where id = p_id
    and (author_id = auth.uid() or public.is_admin());

  if not found then
    raise exception 'That message isn''t yours to delete.';
  end if;
end;
$$;

create or replace function public.chat_mark_read()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.chat_reads (user_id, read_at)
  values (auth.uid(), now())
  on conflict (user_id) do update set read_at = now();
$$;

-- ---------------------------------------------------------------------------
-- Part 5: realtime
-- ---------------------------------------------------------------------------
-- Joins the publication Supabase's realtime service reads. Subscribers still
-- pass the select policy above — a signed-in non-moderator listening on this
-- channel receives nothing. Default replica identity is enough: inserts carry
-- the full row and deletes carry the primary key, which is all the client
-- needs to drop a line.
--
-- The add is wrapped because a table can only join the publication once and
-- re-running this file must stay safe.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Grants — signed-in only; the functions re-check is_moderator themselves
-- ---------------------------------------------------------------------------

revoke all on function public.chat_list_messages(timestamptz) from public, anon;
revoke all on function public.chat_new_messages(timestamptz) from public, anon;
revoke all on function public.chat_unread_count() from public, anon;
revoke all on function public.chat_send(text) from public, anon;
revoke all on function public.chat_delete_message(uuid) from public, anon;
revoke all on function public.chat_mark_read() from public, anon;

grant execute on function public.chat_list_messages(timestamptz) to authenticated;
grant execute on function public.chat_new_messages(timestamptz) to authenticated;
grant execute on function public.chat_unread_count() to authenticated;
grant execute on function public.chat_send(text) to authenticated;
grant execute on function public.chat_delete_message(uuid) to authenticated;
grant execute on function public.chat_mark_read() to authenticated;
