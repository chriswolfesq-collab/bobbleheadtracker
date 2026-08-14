-- Once per account, not once per device.
--
-- The awards intro banner first recorded its dismissal in localStorage, like
-- RepWelcomeBanner does. That makes "once" a property of a browser: dismiss it
-- on a laptop and it still appears on the phone. For a one-time announcement
-- that's a second sighting per device a member owns, which is exactly the nag
-- the banner existed to avoid.
--
-- A timestamp rather than a boolean — same storage, and it answers "when did
-- this land for people" without a second column.
--
-- Safe to re-run.

alter table public.profiles
  add column if not exists awards_intro_ack_at timestamptz;

-- SECURITY DEFINER for the same reason enable_public_shelf() is: profiles has
-- no update policy at all, deliberately, so the client cannot write the table
-- directly and pick its own slug. This is the narrowest possible opening —
-- it writes one column, on exactly the caller's own row, and takes no
-- arguments, so there is nothing to point at anyone else's profile.
--
-- coalesce keeps the first acknowledgement: a double-click, or a second device
-- racing the same dismissal, must not move the timestamp and rewrite history.
create or replace function public.ack_awards_intro()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set awards_intro_ack_at = coalesce(awards_intro_ack_at, now()),
         updated_at = now()
   where id = auth.uid();
$$;

revoke all on function public.ack_awards_intro() from public, anon;
grant execute on function public.ack_awards_intro() to authenticated;
