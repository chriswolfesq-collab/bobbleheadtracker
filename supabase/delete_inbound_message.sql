-- Lets an admin delete a message outright from /admin/messages, rather than only
-- marking it handled. Spam and test submissions have no reason to sit in the
-- queue forever, and "handled" only greys a row out.
--
-- Standalone on purpose: this same function is in inbound_messages.sql for a
-- fresh setup, but re-running a whole setup file to pick up one function is a
-- wide blast radius for a narrow change. Run this file instead.
--
-- (It used to be that inbound_messages.sql would also reinstall
-- notify_inbound_message() with an unsubstituted <WEBHOOK_SECRET>, silently
-- killing the notification email. Since vault_webhook_secret.sql that hazard is
-- gone -- no file carries the literal any more.)
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
