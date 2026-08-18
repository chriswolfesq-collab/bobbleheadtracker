-- Stage 2: members messaging each other, on the tables Stage 1 already built.
--
-- messages.sql carries the whole conversation model already — participants,
-- per-conversation read cursors, the realtime feed, the block table and
-- can_start_direct(). What was missing was the way in. This file is that: one
-- RPC to open a thread with someone, the two that manage a block list, and one
-- redefinition of conversation_send so a block stops a reply as well as a
-- first message.
--
-- Addressing is by shelf slug, matching send_friend_request(p_slug): a slug is
-- what member search returns and what a shared /shelf/<slug> link carries, so it
-- is already how one member names another here.
--
-- Two invariants worth stating, because both are enforced rather than hoped for:
--
--   One thread per pair. conversations.pair_key holds the two ids in a fixed
--   order behind a unique index, so a double-tapped Message button cannot make a
--   second conversation the way a select-then-insert would.
--
--   A refusal never confirms anything. An unknown slug, a member who has
--   messages switched off, a member who blocked you, and a member you blocked
--   all produce the same sentence. Anything more specific turns this RPC into an
--   oracle for who has an account and who has blocked whom -- the same reasoning
--   friends.sql gives for an unknown slug and a private shelf refusing alike.
--
-- Run after messages.sql. Idempotent -- safe to run more than once.

-- ---------------------------------------------------------------------------
-- Part 1: one thread per pair
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column if not exists pair_key text;

-- Who opened it. Only used to rate-limit new conversations (Part 2); the
-- participants decide everything else, and a thread outlives whoever started it.
alter table public.conversations
  add column if not exists created_by uuid references auth.users (id) on delete set null;

create unique index if not exists conversations_pair_key_idx
  on public.conversations (pair_key) where kind = 'direct';

-- A direct thread has a pair, an admin thread has a member; neither has both.
-- Wrapped because constraints have no `if not exists`.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'conversations_pair_matches_kind'
  ) then
    alter table public.conversations
      add constraint conversations_pair_matches_kind
      check ((kind = 'direct') = (pair_key is not null));
  end if;
end;
$$;

-- The two ids in a fixed order, so a pair has one key whichever side asks.
create or replace function public.direct_pair_key(p_a uuid, p_b uuid)
returns text
language sql
immutable
as $$
  select least(p_a::text, p_b::text) || ':' || greatest(p_a::text, p_b::text);
$$;

-- ---------------------------------------------------------------------------
-- Part 2: opening a thread
-- ---------------------------------------------------------------------------
-- Takes the first message with it: a conversation with nothing in it is a row
-- nobody asked for, and it would sit in the other person's inbox saying nothing.
--
-- The daily cap counts NEW threads only, and only the ones this caller opened.
-- Replying is unlimited (the per-message rate limit in messages.sql covers that);
-- what this stops is one account working down a list of 137 members. Ten a day is
-- far more than anyone reaches for honestly.
create or replace function public.start_direct_conversation(p_slug text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
  v_key text;
  v_conversation_id uuid;
  v_recent int;
begin
  if auth.uid() is null then
    raise exception 'Sign in to send a message.';
  end if;

  if char_length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Nothing to send.';
  end if;

  select id into v_target
  from public.profiles
  where slug = lower(btrim(coalesce(p_slug, '')));

  -- One sentence for every way this can fail. See the header.
  if v_target is null or not public.can_start_direct(v_target) then
    raise exception 'You can''t start a conversation with that collector.';
  end if;

  v_key := public.direct_pair_key(auth.uid(), v_target);

  select id into v_conversation_id
  from public.conversations
  where kind = 'direct' and pair_key = v_key;

  if v_conversation_id is null then
    select count(*) into v_recent
    from public.conversations
    where kind = 'direct'
      and created_by = auth.uid()
      and created_at > now() - interval '24 hours';

    if v_recent >= 10 then
      raise exception 'You''ve started a lot of new conversations today. Try again tomorrow.'
        using errcode = 'BB429';
    end if;

    begin
      insert into public.conversations (kind, pair_key, created_by)
      values ('direct', v_key, auth.uid())
      returning id into v_conversation_id;

      insert into public.conversation_participants (conversation_id, user_id)
      values (v_conversation_id, auth.uid()), (v_conversation_id, v_target);
    exception when unique_violation then
      -- Both sides pressed Message at once. The other insert won; use its thread
      -- rather than failing something the caller would rightly call a success.
      select id into v_conversation_id
      from public.conversations
      where kind = 'direct' and pair_key = v_key;
    end;
  end if;

  perform public.conversation_send(v_conversation_id, p_body);

  return v_conversation_id;
end;
$$;

revoke all on function public.start_direct_conversation(text, text) from public, anon;
grant execute on function public.start_direct_conversation(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Part 3: blocking
-- ---------------------------------------------------------------------------
-- Blocking is deliberately quiet and one-sided: the blocked member is never told,
-- and nothing disappears from either inbox. History stays readable to both --
-- deleting a conversation because it turned unpleasant would also delete the
-- evidence of it, which is the opposite of what someone blocking usually wants.
create or replace function public.block_member(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select id into v_target
  from public.profiles
  where slug = lower(btrim(coalesce(p_slug, '')));

  if v_target is null or v_target = auth.uid() then
    raise exception 'No such collector.';
  end if;

  insert into public.message_blocks (blocker_id, blocked_id)
  values (auth.uid(), v_target)
  on conflict do nothing;
end;
$$;

revoke all on function public.block_member(text) from public, anon;
grant execute on function public.block_member(text) to authenticated;

create or replace function public.unblock_member(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select id into v_target
  from public.profiles
  where slug = lower(btrim(coalesce(p_slug, '')));

  if v_target is null then
    raise exception 'No such collector.';
  end if;

  delete from public.message_blocks
  where blocker_id = auth.uid() and blocked_id = v_target;
end;
$$;

revoke all on function public.unblock_member(text) from public, anon;
grant execute on function public.unblock_member(text) to authenticated;

-- Settings needs to show a list you can undo. Only ever your own blocks: who
-- blocked YOU is not something this returns, at any call site.
create or replace function public.list_message_blocks()
returns table (
  slug text,
  display_name text,
  avatar_path text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.slug, p.display_name, p.avatar_path, b.created_at
  from public.message_blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke all on function public.list_message_blocks() from public, anon;
grant execute on function public.list_message_blocks() to authenticated;

-- ---------------------------------------------------------------------------
-- Part 4: a block stops replies too
-- ---------------------------------------------------------------------------
-- Redefines conversation_send from messages.sql, which no longer owns it: a
-- block that only stopped the FIRST message would leave every existing thread
-- open, and "block" would mean nothing to the person who most needed it.
--
-- Only direct threads are checked. accepts_messages is deliberately NOT checked
-- here either -- switching messages off means "don't let new people start one",
-- not "silently break the conversations I'm already in".
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
-- Every name in this function's RETURNS TABLE (id, conversation_id, body,
-- sender_id, sender_role, sender_name, created_at) is also a column name in the
-- tables it touches, which makes an unqualified reference ambiguous — a 42702
-- raised at runtime on the *successful* path, where a test that only checks
-- refusals never reaches it. This directive resolves such names to the column,
-- which is what every statement below means; nothing here uses them as variables.
#variable_conflict use_column
declare
  v_is_participant boolean;
  v_kind text;
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

  -- Aliased: this function's RETURNS TABLE puts an `id` in scope as a variable,
  -- so an unqualified `where id = ...` is ambiguous rather than wrong-but-working.
  select c.kind into v_kind from public.conversations c where c.id = p_conversation_id;

  if v_kind = 'direct' and exists (
    select 1
    from public.conversation_participants p
    join public.message_blocks b
      on (b.blocker_id = p.user_id and b.blocked_id = auth.uid())
      or (b.blocker_id = auth.uid() and b.blocked_id = p.user_id)
    where p.conversation_id = p_conversation_id
      and p.user_id <> auth.uid()
  ) then
    -- Said the same way to both sides: the blocked member learns the thread is
    -- closed, not that they were blocked, and the blocker isn't reminded either.
    raise exception 'You can''t send messages in this conversation any more.';
  end if;

  -- Aliased throughout: this function's RETURNS TABLE puts `id`, `conversation_id`
  -- and `sender_id` in scope as plpgsql variables, so any unqualified reference to
  -- a column of the same name is ambiguous and raises 42702 at runtime.
  select exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id and cp.user_id = auth.uid()
  ) into v_is_participant;

  -- Staff is whoever is answering a thread they are not in. An admin writing in
  -- their OWN thread is a member there, which is what keeps the console from
  -- showing the owner talking to themselves in two voices.
  v_role := case when v_is_participant then 'member' else 'admin' end;

  select pr.display_name into v_name from public.profiles pr where pr.id = auth.uid();

  insert into public.conversation_messages
    (conversation_id, sender_id, sender_role, sender_name, body)
  values
    (p_conversation_id, auth.uid(), v_role, v_name, btrim(p_body))
  returning conversation_messages.id into v_id;

  -- Sending is reading: your own message must not come back to you as unread.
  insert into public.conversation_reads as r (conversation_id, user_id, read_at)
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
