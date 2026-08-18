-- Finding other collectors by name, so a friend request no longer requires
-- already having someone's shelf link.
--
-- The story so far. friends.sql addressed requests by shelf slug because that
-- was the only way members found each other: "the only way members find each
-- other today is a shared /shelf/<slug> link, so that link is also how you
-- ask." That made an unknown slug and a private shelf return the same refusal,
-- to preserve the "you can't probe who has an account" stance in schema.sql's
-- profiles notes. Then all_shelves_public.sql retired the private shelf
-- entirely: every profile now has a minted slug and a live /shelf/<slug> page.
--
-- So the stance this protects has already moved. What is left to protect is the
-- gap between public and *listed*: shelf pages are reachable by link but are
-- not in sitemap.ts and /profile is disallowed in robots.ts, so nobody can
-- currently enumerate the membership. This function opens that enumeration to
-- signed-in members only, and deliberately no further:
--
--   * authenticated-only, nothing for anon (the friends.sql grant posture), so
--     a search is always attributable to an account rather than a stray GET.
--   * no listing mode. Under two characters returns zero rows, so there is no
--     query that means "everyone" — including the empty string, and including
--     a bare '%' or '_', which are escaped to literals below rather than left
--     to act as wildcards. That escaping is the whole ballgame: without it the
--     two-character floor is decoration, since '%%' would match every member.
--   * display name and slug only. Email is NOT searchable, at any length: a
--     hit on an address confirms whether that address holds an account, which
--     turns a list of known emails into a membership test. Nothing here can
--     answer a question about an email.
--   * it returns exactly the three fields a /shelf/<slug> page already shows a
--     stranger — name, avatar, slug — and never a count, an item, or a
--     preference. Discovery gets you to the shelf; the shelf's own rules
--     (friends.sql, friends_visibility.sql) still decide what you see there.
--
-- Requests themselves still go through send_friend_request(p_slug), so the
-- hourly cap and every state invariant stay in one place. That is also why
-- rows with a null slug are skipped: unaddressable, so not worth surfacing.
--
-- Idempotent. Needs schema.sql, avatars.sql, friends.sql, all_shelves_public.sql.

-- ---------------------------------------------------------------------------
-- Part 1: the index
-- ---------------------------------------------------------------------------
-- Case-insensitive prefix matching wants text_pattern_ops. The substring half
-- of the search still scans, which at this membership size costs nothing; if
-- it ever does, the fix is pg_trgm, not a wider index here.

create index if not exists profiles_display_name_lower_idx
  on public.profiles (lower(display_name) text_pattern_ops);

-- ---------------------------------------------------------------------------
-- Part 2: the search
-- ---------------------------------------------------------------------------
-- Returns the caller's standing with each hit alongside it, so one round trip
-- renders the right button per row and the list can't disagree with the
-- Friends tab about who is already a friend. The status vocabulary is
-- friend_shelf_status's, minus 'self' (excluded) and 'signed-out'
-- (unreachable): 'none' | 'pending_out' | 'pending_in' | 'friends'.

create or replace function public.search_members(p_query text)
returns table (
  user_id uuid,
  display_name text,
  avatar_path text,
  slug text,
  status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_needle text;
  v_escaped text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  v_needle := lower(trim(coalesce(p_query, '')));

  -- The floor. Two characters is short enough to find "Al" and long enough
  -- that no one walks the alphabet a letter at a time.
  if length(v_needle) < 2 then
    return;
  end if;

  -- Wildcards become literals: a member who searches '%' is looking for a
  -- percent sign, not for everybody. Backslash first, or it would escape the
  -- escapes added after it.
  v_escaped := replace(replace(replace(v_needle, '\', '\\'), '%', '\%'), '_', '\_');

  return query
  select
    p.id,
    p.display_name,
    p.avatar_path,
    p.slug,
    case
      when exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and ((f.requester_id = auth.uid() and f.addressee_id = p.id)
            or (f.requester_id = p.id and f.addressee_id = auth.uid()))
      ) then 'friends'
      when exists (
        select 1 from public.friendships f
        where f.requester_id = auth.uid() and f.addressee_id = p.id and f.status = 'pending'
      ) then 'pending_out'
      when exists (
        select 1 from public.friendships f
        where f.requester_id = p.id and f.addressee_id = auth.uid() and f.status = 'pending'
      ) then 'pending_in'
      else 'none'
    end
  from public.profiles p
  where p.is_public
    and p.slug is not null
    and p.id <> auth.uid()
    and (
      lower(p.display_name) like '%' || v_escaped || '%' escape '\'
      or lower(p.slug) like '%' || v_escaped || '%' escape '\'
    )
  order by
    -- Exact name, then names that start with the query, then the rest. Within
    -- a band, alphabetical: a stable order matters more than a cleverer score
    -- when the whole result set fits on one screen.
    case
      when lower(p.display_name) = v_needle then 0
      when lower(p.display_name) like v_escaped || '%' escape '\' then 1
      else 2
    end,
    p.display_name,
    p.id
  limit 20;
end;
$$;

revoke all on function public.search_members(text) from public, anon;
grant execute on function public.search_members(text) to authenticated;
