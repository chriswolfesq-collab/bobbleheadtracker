-- Lets an admin delete a message outright from /admin/messages, rather than only
-- marking it handled. Spam and test submissions have no reason to sit in the
-- queue forever, and "handled" only greys a row out.
--
-- Standalone on purpose: this same function is in inbound_messages.sql for a
-- fresh setup, but that file also rewrites notify_inbound_message() with a
-- <WEBHOOK_SECRET> placeholder, so re-running the whole thing would break the
-- notification email. Run this file instead.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL editor.

-- Security definer with its own is_admin() check, matching
-- admin_mark_message_handled: there is no delete policy on inbound_messages, so
-- this function is the only way in and an admin can't delete by selecting the
-- table directly.
create or replace function public.admin_delete_inbound_message(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.inbound_messages where id = p_id;

  -- The caller just clicked a row it had on screen, so a miss means someone
  -- else deleted it first. Say so rather than reporting a silent success.
  if not found then
    raise exception 'message not found';
  end if;
end;
$$;

revoke all on function public.admin_delete_inbound_message(uuid) from public, anon;
grant execute on function public.admin_delete_inbound_message(uuid) to authenticated;
