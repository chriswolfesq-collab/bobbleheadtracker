-- On-site messages: an inbox every member has, and threads instead of email.
--
-- Stage 1 (this file) carries member <-> admin threads. Stage 2 opens the same
-- tables to member <-> member without a migration: the participant model, the
-- read/unread machinery, the rate limit, the block list and the realtime feed
-- are all built pair-agnostic here, and `conversations.kind` is the gate.
--
-- Why not extend chat.sql: that is ONE room for everyone who moderates, keyed on
-- is_moderator(), with a single global read cursor per person. A conversation
-- has a membership, a per-conversation cursor, and a different answer to "may I
-- read this" for every row. Nothing of its schema survives the change; its
-- shape, though, is worth copying beat for beat, and this file does:
--
--   * RLS enabled, writes only through security-definer RPCs. A select policy
--     exists on the message table because the realtime service applies it to
--     each subscriber -- that policy is what makes a live thread possible
--     without handing the client write access.
--   * An insert carries no meaning to the client beyond "call the reader" --
--     one read path, a live profile join, and a dropped socket degrades to
--     refetch-on-visibility rather than showing nothing.
--   * sender_name stamped at write time, sender_id nulled on account deletion:
--     losing one side of a conversation would leave the other side answering
--     nobody.
--
-- What this file deliberately does NOT do: replace the email reply to someone
-- who has no account. The contact form is open to anyone (see
-- inbound_messages.sql -- that is its whole point), and a stranger has no inbox
-- to read. Those keep the email path in inbound_message_replies.sql. A message
-- from a signed-in member becomes a thread here instead.
--
-- Needs: schema.sql (profiles, is_admin), avatars.sql (profiles.avatar_path),
-- email_preferences.sql (wants_email, extended at the end of this file).
--
-- Idempotent -- safe to run more than once. Paste into the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- Part 1: the tables
-- ---------------------------------------------------------------------------

-- A conversation is a container with a membership. `kind` is the only thing
-- that differs between the two flavors:
--
--   'admin'  -- one member on one side, whoever holds admin on the other. The
--              staff side is a role, not a person, so it is NOT a participant
--              row: admins come and go, and a thread answered by a departed
--              admin must still be answerable. Same reasoning as the rep
--              chatroom being keyed on is_moderator() rather than a roster.
--   'direct' -- two members, both participants. Stage 2.
--
-- member_id exists only for 'admin' threads and is what keeps them one per
-- person: the unique index below is why "message the admin" twice continues a
-- thread instead of starting a second one.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('admin', 'direct')),
  member_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Denormalized so the inbox can sort without touching the message table.
  -- Maintained by the trigger in Part 2.
  last_message_at timestamptz not null default now(),
  constraint conversations_member_matches_kind
    check ((kind = 'admin') = (member_id is not null))
);

create unique index if not exists conversations_admin_member_idx
  on public.conversations (member_id) where kind = 'admin';

create index if not exists conversations_recent_idx
  on public.conversations (last_message_at desc);

alter table public.conversations enable row level security;

-- Who is in a conversation. For an 'admin' thread that is the member alone.
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- The inbox reads "my conversations, newest first", which is this index.
create index if not exists conversation_participants_user_idx
  on public.conversation_participants (user_id);

alter table public.conversation_participants enable row level security;

-- Where each reader left off, and when we last emailed them about it.
--
-- Separate from participants on purpose: an admin reading a thread is not a
-- member of it, but still needs a cursor, and wiring one table to mean both
-- "belongs to" and "has read up to" is how the staff side ends up unable to
-- have unread counts. Keyed on any user id, participant or not.
create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  -- Throttles the notification email; see notify_conversation_message.
  notified_at timestamptz,
  primary key (conversation_id, user_id)
);

alter table public.conversation_reads enable row level security;

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references auth.users (id) on delete set null,
  -- Stamped, not derived: 'admin' means "this was sent by staff", and it has to
  -- keep saying that after the sender loses admin or deletes their account.
  -- Derived at write time from whether the sender is a participant, so an admin
  -- messaging staff about their OWN thread still reads as the member.
  sender_role text not null check (sender_role in ('member', 'admin')),
  sender_name text,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_thread_idx
  on public.conversation_messages (conversation_id, created_at desc);
-- The rate limit counts one sender's recent rows on every insert.
create index if not exists conversation_messages_sender_recent_idx
  on public.conversation_messages (sender_id, created_at desc);

alter table public.conversation_messages enable row level security;

-- Who has shut whom out. Written in Stage 1, enforced by can_start_direct()
-- below, and only reachable from the UI in Stage 2 -- blocking the admin is not
-- a thing, so there is nothing for it to do until member-to-member opens.
create table if not exists public.message_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint message_blocks_not_self check (blocker_id <> blocked_id)
);

alter table public.message_blocks enable row level security;

-- The per-user opt-out. Governs who may START a direct conversation with you;
-- it deliberately does NOT gate the admin thread, because "I can't reach the
-- site owner" is not a setting anyone means to switch on.
alter table public.profiles
  add column if not exists accepts_messages boolean not null default true;

-- "You have a new message" mail. Same on-by-default reasoning as the other
-- email_* columns in email_preferences.sql.
alter table public.profiles
  add column if not exists email_messages boolean not null default true;

-- ---------------------------------------------------------------------------
-- Part 2: who may read what
-- ---------------------------------------------------------------------------
-- One predicate, used by the select policy AND by every RPC below, so there is
-- a single answer to "may I see this thread" rather than one per call site.
create or replace function public.can_read_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and (
        exists (
          select 1 from public.conversation_participants p
          where p.conversation_id = c.id and p.user_id = auth.uid()
        )
        or (c.kind = 'admin' and public.is_admin())
      )
  );
$$;

revoke all on function public.can_read_conversation(uuid) from public, anon;
grant execute on function public.can_read_conversation(uuid) to authenticated;

-- Select-only, matching chat_messages: this is what the realtime service checks
-- for each subscriber, so a member listening on the feed receives their own
-- threads and nothing else. Every write goes through an RPC.
drop policy if exists "conversation_messages: participant select" on public.conversation_messages;
create policy "conversation_messages: participant select"
  on public.conversation_messages for select
  to authenticated
  using (public.can_read_conversation(conversation_id));

-- The other three tables have RLS on with NO policies: nothing reads them
-- directly, the same posture as friendships and photo_votes. Their contents are
-- projected by the RPCs, which is what keeps a membership list from being an
-- oracle for who has an account.

-- Keeps conversations.last_message_at honest without the writers having to
-- remember. A message can only be inserted by conversation_send/message_admin,
-- but the invariant belongs next to the data.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists touch_conversation_on_message on public.conversation_messages;
create trigger touch_conversation_on_message
  after insert on public.conversation_messages
  for each row
  execute function public.touch_conversation();

-- ---------------------------------------------------------------------------
-- Part 3: rate limit
-- ---------------------------------------------------------------------------
-- Its own trigger counting only its own rows, for the reason chat's has its
-- own: sharing a limiter means a busy conversation locks someone out of an
-- unrelated feature. 60/hour is a message a minute sustained -- past any real
-- exchange, and still a ceiling on a runaway client or a spammer.
create or replace function public.enforce_conversation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent int;
begin
  select count(*) into v_recent
  from public.conversation_messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 hour';

  if v_recent >= 60 then
    raise exception 'You''re sending messages faster than we can carry them. Give it a minute.'
      using errcode = 'BB429';
  end if;

  return new;
end;
$$;

drop trigger if exists rate_limit_conversation_messages on public.conversation_messages;
create trigger rate_limit_conversation_messages
  before insert on public.conversation_messages
  for each row
  execute function public.enforce_conversation_rate_limit();

-- ---------------------------------------------------------------------------
-- Part 4: reading
-- ---------------------------------------------------------------------------
-- Both message readers return the same columns and join profiles live for the
-- name and avatar, so a line looks identical on first paint, after a realtime
-- nudge, or on a catch-up refetch. Staff lines carry no personal identity at
-- all: they render as the site, which is why sender_name is ignored for them.
create or replace function public.conversation_list_messages(
  p_conversation_id uuid,
  p_before timestamptz default null
)
returns table (
  id uuid,
  conversation_id uuid,
  body text,
  sender_id uuid,
  sender_role text,
  sender_name text,
  sender_avatar_path text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.conversation_id,
    m.body,
    m.sender_id,
    m.sender_role,
    case when m.sender_role = 'admin' then null else coalesce(p.display_name, m.sender_name) end,
    case when m.sender_role = 'admin' then null else p.avatar_path end,
    m.created_at
  from public.conversation_messages m
  left join public.profiles p on p.id = m.sender_id
  where m.conversation_id = p_conversation_id
    and public.can_read_conversation(p_conversation_id)
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit 50;
$$;

revoke all on function public.conversation_list_messages(uuid, timestamptz) from public, anon;
grant execute on function public.conversation_list_messages(uuid, timestamptz) to authenticated;

create or replace function public.conversation_new_messages(
  p_conversation_id uuid,
  p_since timestamptz
)
returns table (
  id uuid,
  conversation_id uuid,
  body text,
  sender_id uuid,
  sender_role text,
  sender_name text,
  sender_avatar_path text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.conversation_id,
    m.body,
    m.sender_id,
    m.sender_role,
    case when m.sender_role = 'admin' then null else coalesce(p.display_name, m.sender_name) end,
    case when m.sender_role = 'admin' then null else p.avatar_path end,
    m.created_at
  from public.conversation_messages m
  left join public.profiles p on p.id = m.sender_id
  where m.conversation_id = p_conversation_id
    and public.can_read_conversation(p_conversation_id)
    and m.created_at > p_since
  order by m.created_at;
$$;

revoke all on function public.conversation_new_messages(uuid, timestamptz) from public, anon;
grant execute on function public.conversation_new_messages(uuid, timestamptz) to authenticated;

-- The inbox: one row per conversation the caller is IN. Admins do not see the
-- queue through this -- their own threads only -- because the console has its
-- own view below and merging the two would put 137 members' threads in the
-- owner's personal inbox.
--
-- `title` is resolved server-side: profiles is owner-read-only, so the client
-- cannot join for the other party's name itself.
create or replace function public.inbox_list()
returns table (
  conversation_id uuid,
  kind text,
  title text,
  other_slug text,
  other_avatar_path text,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_role text,
  unread_count int
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select c.id, c.kind, c.last_message_at
    from public.conversations c
    join public.conversation_participants p
      on p.conversation_id = c.id and p.user_id = auth.uid()
  ),
  last_msg as (
    select distinct on (m.conversation_id)
      m.conversation_id, m.body, m.sender_role, m.created_at
    from public.conversation_messages m
    where m.conversation_id in (select id from mine)
    order by m.conversation_id, m.created_at desc
  )
  select
    mine.id,
    mine.kind,
    case
      when mine.kind = 'admin' then 'Bobble Shelf'
      else coalesce(other.display_name, 'A collector')
    end,
    case when mine.kind = 'admin' then null else other.slug end,
    case when mine.kind = 'admin' then null else other.avatar_path end,
    mine.last_message_at,
    left(last_msg.body, 140),
    last_msg.sender_role,
    (
      select count(*)::int
      from public.conversation_messages m
      where m.conversation_id = mine.id
        and m.sender_id is distinct from auth.uid()
        and m.created_at > coalesce(
          (select r.read_at from public.conversation_reads r
            where r.conversation_id = mine.id and r.user_id = auth.uid()),
          'epoch'::timestamptz
        )
    )
  from mine
  left join last_msg on last_msg.conversation_id = mine.id
  -- The other participant, for a direct thread. Null for an admin thread, whose
  -- other side is a role rather than a person.
  left join lateral (
    select pr.display_name, pr.slug, pr.avatar_path
    from public.conversation_participants op
    join public.profiles pr on pr.id = op.user_id
    where op.conversation_id = mine.id and op.user_id <> auth.uid()
    limit 1
  ) other on true
  order by mine.last_message_at desc;
$$;

revoke all on function public.inbox_list() from public, anon;
grant execute on function public.inbox_list() to authenticated;

-- The header badge. Counts only conversations the caller is in, so an admin's
-- badge is about their own mail and the console carries the queue count.
create or replace function public.inbox_unread_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    (
      select count(*)
      from public.conversation_messages m
      where m.conversation_id = p.conversation_id
        and m.sender_id is distinct from auth.uid()
        and m.created_at > coalesce(
          (select r.read_at from public.conversation_reads r
            where r.conversation_id = p.conversation_id and r.user_id = auth.uid()),
          'epoch'::timestamptz
        )
    )
  ), 0)::int
  from public.conversation_participants p
  where p.user_id = auth.uid();
$$;

revoke all on function public.inbox_unread_count() from public, anon;
grant execute on function public.inbox_unread_count() to authenticated;

-- ---------------------------------------------------------------------------
-- Part 5: writing
-- ---------------------------------------------------------------------------
-- Returns the stored row in the reader's shape, so the sender sees their own
-- line immediately even if the socket never delivers the echo.
create or replace function public.conversation_send(p_conversation_id uuid, p_body text)
returns table (
  id uuid,
  conversation_id uuid,
  body text,
  sender_id uuid,
  sender_role text,
  sender_name text,
  sender_avatar_path text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_participant boolean;
  v_role text;
  v_name text;
  v_id uuid;
begin
  if char_length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Nothing to send.';
  end if;

  if not public.can_read_conversation(p_conversation_id) then
    -- Same refusal whether the thread is someone else's or doesn't exist, so a
    -- guessed id can't confirm that a conversation is there.
    raise exception 'That conversation isn''t yours.';
  end if;

  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) into v_is_participant;

  -- Staff is whoever is answering a thread they are not in. An admin writing in
  -- their OWN thread is a member there, which is what keeps the console from
  -- showing the owner talking to themselves in two voices.
  v_role := case when v_is_participant then 'member' else 'admin' end;

  select display_name into v_name from public.profiles where id = auth.uid();

  insert into public.conversation_messages
    (conversation_id, sender_id, sender_role, sender_name, body)
  values
    (p_conversation_id, auth.uid(), v_role, v_name, btrim(p_body))
  returning conversation_messages.id into v_id;

  -- Sending is reading: your own message must not come back to you as unread.
  insert into public.conversation_reads (conversation_id, user_id, read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set read_at = now();

  return query
    select m.id, m.conversation_id, m.body, m.sender_id, m.sender_role,
           case when m.sender_role = 'admin' then null else coalesce(p.display_name, m.sender_name) end,
           case when m.sender_role = 'admin' then null else p.avatar_path end,
           m.created_at
    from public.conversation_messages m
    left join public.profiles p on p.id = m.sender_id
    where m.id = v_id;
end;
$$;

revoke all on function public.conversation_send(uuid, text) from public, anon;
grant execute on function public.conversation_send(uuid, text) to authenticated;

-- "Message the admin" -- from /contact for a signed-in sender, or the inbox.
-- Creates the thread on first use and continues it forever after; returns the
-- conversation id so the caller can open it.
--
-- Not gated on accepts_messages: that setting governs other members, and being
-- unreachable by the site owner is not what anyone means by switching it off.
create or replace function public.message_admin(p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to message us.';
  end if;

  if char_length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Nothing to send.';
  end if;

  select id into v_conversation_id
  from public.conversations
  where kind = 'admin' and member_id = auth.uid();

  if v_conversation_id is null then
    insert into public.conversations (kind, member_id)
    values ('admin', auth.uid())
    returning id into v_conversation_id;

    insert into public.conversation_participants (conversation_id, user_id)
    values (v_conversation_id, auth.uid())
    on conflict do nothing;
  end if;

  perform public.conversation_send(v_conversation_id, p_body);

  return v_conversation_id;
end;
$$;

revoke all on function public.message_admin(text) from public, anon;
grant execute on function public.message_admin(text) to authenticated;

create or replace function public.conversation_mark_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_read_conversation(p_conversation_id) then
    raise exception 'That conversation isn''t yours.';
  end if;

  insert into public.conversation_reads (conversation_id, user_id, read_at)
  values (p_conversation_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set read_at = now();
end;
$$;

revoke all on function public.conversation_mark_read(uuid) from public, anon;
grant execute on function public.conversation_mark_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Part 6: the Stage 2 gate
-- ---------------------------------------------------------------------------
-- Everything member-to-member needs, minus the RPC that opens it. Written now
-- so the rules live with the tables they constrain, and so Stage 2 is a UI and
-- one `start_direct_conversation` away rather than another schema change.
--
-- Three ways to be unreachable, and the caller learns which only as a single
-- refusal: they turned messages off, they blocked you, or you blocked them.
create or replace function public.can_start_direct(p_target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_target_id is not null
    and auth.uid() is not null
    and p_target_id <> auth.uid()
    and coalesce((select accepts_messages from public.profiles where id = p_target_id), true)
    and not exists (
      select 1 from public.message_blocks b
      where (b.blocker_id = p_target_id and b.blocked_id = auth.uid())
         or (b.blocker_id = auth.uid() and b.blocked_id = p_target_id)
    );
$$;

revoke all on function public.can_start_direct(uuid) from public, anon;
grant execute on function public.can_start_direct(uuid) to authenticated;

-- The switch behind that first condition, for /settings.
create or replace function public.set_accepts_messages(p_enabled boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set accepts_messages = coalesce(p_enabled, true)
  where id = auth.uid();
$$;

revoke all on function public.set_accepts_messages(boolean) from public, anon;
grant execute on function public.set_accepts_messages(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Part 7: the admin console's view
-- ---------------------------------------------------------------------------
-- Every member thread, unhandled-feeling ones first: most recently active at
-- the top, with this admin's own unread count. Unread here counts only lines
-- from the member -- another admin's reply is not something you need to read,
-- and counting it would leave the queue permanently bold in a two-admin site.
create or replace function public.admin_list_conversations()
returns table (
  conversation_id uuid,
  member_id uuid,
  member_name text,
  member_slug text,
  member_email text,
  member_avatar_path text,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_role text,
  message_count int,
  unread_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.member_id,
    coalesce(p.display_name, 'A collector'),
    p.slug,
    u.email,
    p.avatar_path,
    c.last_message_at,
    left(last_msg.body, 140),
    last_msg.sender_role,
    (select count(*)::int from public.conversation_messages m where m.conversation_id = c.id),
    (
      select count(*)::int
      from public.conversation_messages m
      where m.conversation_id = c.id
        and m.sender_role = 'member'
        and m.created_at > coalesce(
          (select r.read_at from public.conversation_reads r
            where r.conversation_id = c.id and r.user_id = auth.uid()),
          'epoch'::timestamptz
        )
    )
  from public.conversations c
  left join public.profiles p on p.id = c.member_id
  left join auth.users u on u.id = c.member_id
  left join lateral (
    select m.body, m.sender_role
    from public.conversation_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) last_msg on true
  where c.kind = 'admin'
    and public.is_admin()
  order by c.last_message_at desc;
$$;

revoke all on function public.admin_list_conversations() from public, anon;
grant execute on function public.admin_list_conversations() to authenticated;

-- Count for the admin console's nav badge, alongside the other queue counts.
create or replace function public.admin_unread_conversation_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_admin() then (
    select count(*)::int
    from public.conversation_messages m
    join public.conversations c on c.id = m.conversation_id
    where c.kind = 'admin'
      and m.sender_role = 'member'
      and m.created_at > coalesce(
        (select r.read_at from public.conversation_reads r
          where r.conversation_id = c.id and r.user_id = auth.uid()),
        'epoch'::timestamptz
      )
  ) else 0 end;
$$;

revoke all on function public.admin_unread_conversation_count() from public, anon;
grant execute on function public.admin_unread_conversation_count() to authenticated;

-- ---------------------------------------------------------------------------
-- Part 8: realtime
-- ---------------------------------------------------------------------------
-- Joins the publication the realtime service reads. Each subscriber still
-- passes the select policy above, so a member receives inserts for their own
-- threads only. Default replica identity is enough: an insert carries the full
-- row, and the client treats it purely as a nudge to call the reader.
--
-- Wrapped because a table can only join the publication once and re-running
-- this file must stay safe.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_messages'
  ) then
    alter publication supabase_realtime add table public.conversation_messages;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Part 9: the email preference
-- ---------------------------------------------------------------------------
-- Extends wants_email() with the 'messages' kind. Reproduced whole because the
-- function is one CASE over every kind -- this is the live definition as of
-- 2026-08-18 (six kinds) plus one, and this file now owns it. Adding a kind
-- later means editing THIS copy; a re-run of email_preferences.sql or
-- weekly_digest.sql will silently drop 'messages' and fail closed, which reads
-- as "message email quietly stopped working".
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
                 when 'messages' then p.email_messages
                 -- An unknown kind is a bug in the caller. Fail closed rather
                 -- than mailing on a preference nobody can turn off.
                 else false
               end
        from public.profiles p
        where p.id = p_user_id
      ),
      -- No profile row: honor the master default (on) for known kinds only.
      p_kind in ('all', 'wanted_alerts', 'submission_updates', 'rep_digest',
                 'weekly_digest', 'forum_digest', 'messages')
    )
  end;
$$;

revoke all on function public.wants_email(uuid, text) from public, anon;
grant execute on function public.wants_email(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Part 10: the Settings switch
-- ---------------------------------------------------------------------------
-- Extends set_email_preference with the 'messages' kind, and like Part 9 this
-- file now owns the function. Reproduced whole for the same reason: it is one
-- allow-list plus one UPDATE over every column, so a kind can only be added by
-- editing the whole thing. This is the live definition as of 2026-08-18 plus
-- 'messages'. Re-running email_preferences.sql (or whichever file last owned it)
-- drops the new kind, and the symptom is a Settings switch that raises
-- "unknown email preference".
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
    ('all', 'wanted_alerts', 'submission_updates', 'rep_digest', 'weekly_digest',
     'forum_digest', 'messages') then
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
    email_messages =
      case when p_kind = 'messages' then v_enabled else email_messages end,
    updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.set_email_preference(text, boolean) from public, anon;
grant execute on function public.set_email_preference(text, boolean) to authenticated;
