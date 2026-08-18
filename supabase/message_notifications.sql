-- "You have a new message" mail for on-site conversations.
--
-- Separate from messages.sql on purpose: that file is the schema and can be
-- re-read as one, while this is the sender, and a sender is the thing you come
-- back to edit (a new recipient rule, a different cooldown). Run messages.sql
-- first; this needs conversation_reads, wants_email's 'messages' kind, and
-- webhook_secret.sql.
--
-- Who gets mailed is the other side of the thread, never the sender:
--
--   a member wrote  -> every admin who hasn't switched automated mail off
--   an admin wrote  -> the member whose thread it is
--   direct (Stage 2) -> the other participants
--
-- The cooldown is per recipient per conversation, not global: a back-and-forth
-- that lasts ten minutes should produce one email, but two different people
-- writing to you should produce two. conversation_reads.notified_at carries it,
-- which is also why that column lives on the read cursor rather than in its own
-- table — "when did we last nudge you about this thread" and "how far have you
-- read in it" are answered together or not at all.
--
-- Idempotent -- safe to run more than once. Paste into the Supabase SQL editor.

create extension if not exists pg_net with schema extensions;

-- Fifteen minutes. Long enough that a rapid exchange is one email, short enough
-- that a reply an hour later still reaches someone who has closed the tab.
create or replace function public.notify_conversation_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_member_id uuid;
  v_sender_label text;
  v_recipients jsonb := '[]'::jsonb;
  r record;
begin
  select kind, member_id into v_kind, v_member_id
  from public.conversations
  where id = new.conversation_id;

  -- Staff mail is signed as the site, matching how a staff line renders in the
  -- thread; a member is named, because that is who you are replying to.
  v_sender_label := case
    when new.sender_role = 'admin' then 'Bobble Shelf'
    else coalesce(nullif(btrim(coalesce(new.sender_name, '')), ''), 'A collector')
  end;

  for r in
    -- The other side, whoever that is for this kind of thread. auth.users is
    -- joined here rather than in the caller because only a definer function can
    -- read it, and the edge function must never be handed a user id to resolve.
    select u.id as user_id, u.email
    from auth.users u
    where u.id <> coalesce(new.sender_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and u.email is not null
      and (
        -- A member wrote in: tell the admins.
        (new.sender_role = 'member' and v_kind = 'admin' and exists (
          select 1 from public.admins ad where lower(ad.email) = lower(u.email)
        ))
        -- Staff answered: tell the member whose thread it is.
        or (new.sender_role = 'admin' and v_kind = 'admin' and u.id = v_member_id)
        -- Stage 2: the other participants of a direct thread.
        or (v_kind = 'direct' and exists (
          select 1 from public.conversation_participants p
          where p.conversation_id = new.conversation_id and p.user_id = u.id
        ))
      )
      and public.wants_email(u.id, 'messages')
  loop
    -- Claim the cooldown slot for this recipient on this thread. read_at is
    -- seeded to epoch rather than now() on insert: writing now() here would
    -- silently mark the message we are emailing about as already read.
    insert into public.conversation_reads (conversation_id, user_id, read_at, notified_at)
    values (new.conversation_id, r.user_id, 'epoch'::timestamptz, now())
    on conflict (conversation_id, user_id) do update
      set notified_at = now()
      where public.conversation_reads.notified_at is null
         or public.conversation_reads.notified_at < now() - interval '15 minutes';

    -- The upsert above only touches a row whose cooldown has expired, so a
    -- claim that changed nothing means "we already told them recently".
    if found then
      v_recipients := v_recipients || to_jsonb(r.email);
    end if;
  end loop;

  if jsonb_array_length(v_recipients) = 0 then
    return new;
  end if;

  perform net.http_post(
    url := 'https://mawwzvnlihhsagatmolq.supabase.co/functions/v1/notify-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', public.webhook_secret()
    ),
    body := jsonb_build_object(
      'recipients', v_recipients,
      'sender_label', v_sender_label,
      'sender_role', new.sender_role,
      -- Which inbox to send them to. Decided here because the database is what
      -- knows the thread's kind; the mailer must not have to infer it from the
      -- sender's role, which is the same 'member' for a direct thread.
      'audience', case
        when new.sender_role = 'member' and v_kind = 'admin' then 'admins'
        else 'member'
      end,
      'preview', left(new.body, 300)
    )
  );

  return new;
end;
$$;

drop trigger if exists on_conversation_message_created on public.conversation_messages;
create trigger on_conversation_message_created
  after insert on public.conversation_messages
  for each row
  execute function public.notify_conversation_message();
