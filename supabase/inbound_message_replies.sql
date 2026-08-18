-- Answering a message from inside the admin console, and keeping the answer.
--
-- Until now the only way to reply to a /contact message or a rep application was
-- to find the notification email and hit Reply (its reply-to is the sender's
-- address). That works right up until it doesn't: the notification is the one
-- copy, so a mail that bounced, landed in spam, or was deleted takes the only
-- route to the sender with it -- and nothing on /admin/messages ever showed
-- whether a message had actually been answered. "Handled" meant "I dealt with
-- this somehow, somewhere else."
--
-- So the reply now goes out from the console through admin-send-email (the same
-- sender the rep and user consoles use, addressed by email because an inbound
-- sender usually has no account) and the text is written down here. Same
-- argument as the header of inbound_messages.sql, one step further along: the
-- row is the record. What was sent is part of the record.
--
-- Replies are keyed to the message rather than stored on it because there can be
-- more than one -- a first answer, then a follow-up -- and because a deleted
-- message should take its correspondence with it (on delete cascade).
--
-- Run after inbound_messages.sql. It REPLACES that file's
-- admin_list_inbound_messages with one that also returns each message's replies;
-- inbound_messages.sql can't carry that version itself, because its own function
-- body would then reference a table that file hasn't created yet.
--
-- Idempotent -- safe to run more than once. Paste into the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------
create table if not exists public.inbound_message_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.inbound_messages (id) on delete cascade,
  body text not null,
  -- Where it actually went, stamped at send time rather than read back through
  -- the parent row: this is the record of what was sent, and the address on the
  -- message could in principle be corrected afterwards.
  sent_to text not null,
  sent_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inbound_message_replies_message_idx
  on public.inbound_message_replies (message_id, created_at);

alter table public.inbound_message_replies enable row level security;

-- Admins read; nobody writes through the table. Like the rest of this queue the
-- only way in is the security-definer function below, so a reply can't be
-- recorded for a message that doesn't exist or attributed to another admin.
drop policy if exists "inbound_message_replies: admin select" on public.inbound_message_replies;
create policy "inbound_message_replies: admin select"
  on public.inbound_message_replies for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Recording a reply
-- ---------------------------------------------------------------------------
-- Called after admin-send-email has accepted the message, so this never decides
-- whether mail goes out -- it only writes down that it did. The sending admin is
-- BCC'd by that function, which is the belt to this braces.
--
-- Replying is what handling a message means, so this marks the parent handled in
-- the same statement rather than leaving the admin to click twice. Reopen still
-- works if an answer turns out to need a follow-up.
create or replace function public.admin_record_inbound_reply(p_message_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_reply_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'a reply needs a body';
  end if;

  select email into v_email
  from public.inbound_messages
  where id = p_message_id;

  -- The caller just replied to a row it had on screen, so a miss means someone
  -- else deleted it first. The email has already gone; say so rather than
  -- reporting a silent success.
  if v_email is null then
    raise exception 'message not found';
  end if;

  insert into public.inbound_message_replies (message_id, body, sent_to, sent_by)
  values (p_message_id, p_body, v_email, auth.uid())
  returning id into v_reply_id;

  update public.inbound_messages set
    status = 'handled',
    handled_at = now(),
    handled_by = auth.uid()
  where id = p_message_id;

  return v_reply_id;
end;
$$;

revoke all on function public.admin_record_inbound_reply(uuid, text) from public, anon;
grant execute on function public.admin_record_inbound_reply(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The queue, now with its replies
-- ---------------------------------------------------------------------------
-- Supersedes the version in inbound_messages.sql. Dropped rather than replaced
-- because the return type changes, and spelled out column by column because
-- `setof public.inbound_messages` can't carry the extra one.
--
-- Replies come back inline as jsonb rather than through a second round trip:
-- there are a handful per message at most, and the console wants to show the
-- correspondence next to the message it answers.
drop function if exists public.admin_list_inbound_messages(text);

create or replace function public.admin_list_inbound_messages(p_kind text default null)
returns table (
  id uuid,
  kind text,
  name text,
  email text,
  team_slug text,
  message text,
  submitted_by uuid,
  status text,
  created_at timestamptz,
  handled_at timestamptz,
  handled_by uuid,
  replies jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.kind,
    m.name,
    m.email,
    m.team_slug,
    m.message,
    m.submitted_by,
    m.status,
    m.created_at,
    m.handled_at,
    m.handled_by,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'body', r.body,
            'sent_to', r.sent_to,
            'created_at', r.created_at
          )
          order by r.created_at
        )
        from public.inbound_message_replies r
        where r.message_id = m.id
      ),
      '[]'::jsonb
    ) as replies
  from public.inbound_messages m
  where public.is_admin()
    and (p_kind is null or m.kind = p_kind)
  order by
    -- Unhandled first, then newest, so the queue reads as a queue.
    case when m.status = 'new' then 0 else 1 end,
    m.created_at desc;
$$;

revoke all on function public.admin_list_inbound_messages(text) from public, anon;
grant execute on function public.admin_list_inbound_messages(text) to authenticated;
