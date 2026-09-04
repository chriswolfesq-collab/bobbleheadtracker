-- Who reps this team, on the team's own page.
--
-- team_reps is keyed by email and readable only through admin_list_team_reps,
-- which is admin-gated, so until now there was no way to find out who looks
-- after a team except to ask. A rep asked for the other direction — the old
-- forum habit of naming the moderators at the foot of the board — so that a
-- member with a wrong listing knows who to send it to.
--
-- Scoped to one team per call, deliberately. A team page names its own rep and
-- learns nothing about any other team's, and there is no whole-site roster to
-- fetch. Admins are not reps: they hold no team_reps row and are never listed
-- here, which is right — an admin editing every team is not the person a Rays
-- collector should be sent to about a Rays listing.
--
-- The email never leaves. Reps are keyed by it and it lives in auth.users,
-- reachable only from a definer function like this one; what comes back is the
-- display name, shelf slug and avatar — the same three fields search_members
-- already returns to any signed-in member — and nothing else.
--
-- Idempotent. Needs schema.sql (team_reps, profiles) and
-- member_search_opt_out.sql (profiles.listed_in_search).

create or replace function public.get_team_reps(p_team_slug text)
returns table (display_name text, slug text, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.display_name, p.slug, p.avatar_path
  from public.team_reps r
  join auth.users u on lower(u.email) = lower(r.email)
  join public.profiles p on p.id = u.id
  where r.team_slug = p_team_slug
    -- A rep who was named by email but has never signed up has no profile to
    -- join, and drops out here. Nothing else can be said about them without
    -- disclosing the address they were invited at.
    and p.slug is not null
    and coalesce(trim(p.display_name), '') <> ''
    and p.is_public
    -- Someone who has switched off "list me in member search" is not named
    -- here either. That switch is about not being browsable by name, and this
    -- is a page anyone can open without asking for them — closer to browsing
    -- than to the shelf link they chose to hand out. It does mean a team whose
    -- rep has it off shows no rep at all, rather than a name they turned down.
    and p.listed_in_search
  order by p.display_name;
$$;

grant execute on function public.get_team_reps(text) to anon, authenticated;
