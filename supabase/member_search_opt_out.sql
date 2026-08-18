-- A way to not turn up in member search.
--
-- member_search.sql opened the roster to name lookup by signed-in members,
-- which is what makes a friend request possible between people who have never
-- swapped links. This adds the other half: a member who would rather not be
-- browsable can say so, without giving up their shelf, their link, or their
-- existing friends.
--
-- On the default. This is ON for everyone, because it has to be: search shipped
-- listing everybody, so defaulting the new column to false would silently
-- remove 136 members from a feature that is already live and already being
-- used. Off is the choice, not the starting point — same posture as
-- friends_see_items, for the opposite reason (there, silence had to mean yes
-- because the audience was already personally accepted; here, silence has to
-- mean yes because the behaviour is already shipped and visible).
--
-- What the switch does NOT do, and the settings copy says so plainly: it is not
-- a private shelf. Shelves are public (all_shelves_public.sql) and there is no
-- longer a toggle for that. So an exact slug match still resolves even when
-- this is off:
--
--   * /shelf/<slug> already renders that shelf to anyone holding the URL, and
--     friend_shelf_status does not consult this column, so the Add friend
--     button on the shelf page itself already works for a hidden member.
--     Refusing the same person in search would leave the two paths disagreeing
--     about whether the member is addressable.
--   * It discloses nothing extra. Anyone typing the exact slug could have typed
--     the exact URL and seen more. Guessing a slug is not enumeration; browsing
--     by name is, and that is precisely what this column stops.
--
-- The practical effect: hidden means no partial or name match, ever, including
-- from existing friends — an absolute rule is one a member can actually predict,
-- and friends are listed on the Friends tab regardless, so nothing is lost.
-- Requests, pending or accepted, are untouched either way.
--
-- This file now owns search_members. Idempotent. Needs member_search.sql.

-- ---------------------------------------------------------------------------
-- Part 1: the column
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists listed_in_search boolean not null default true;

-- ---------------------------------------------------------------------------
-- Part 2: the setter
-- ---------------------------------------------------------------------------
-- profiles has no client UPDATE policy by design (schema.sql), so this follows
-- set_friends_see_items' shape exactly.

create or replace function public.set_listed_in_search(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  update public.profiles
     set listed_in_search = p_enabled,
         updated_at = now()
   where id = auth.uid();
end;
$$;

revoke all on function public.set_listed_in_search(boolean) from public, anon;
grant execute on function public.set_listed_in_search(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Part 3: teach the search to skip them
-- ---------------------------------------------------------------------------
-- Unchanged from member_search.sql except the match clause. Everything the
-- original file argued for still holds and still matters: authenticated-only,
-- the two-character floor, wildcards escaped to literals, no email, id-only
-- projection. The exact-slug branch below deliberately sits OUTSIDE the
-- listed_in_search test, for the reasons in the header.

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

  if length(v_needle) < 2 then
    return;
  end if;

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
      (
        p.listed_in_search
        and (
          lower(p.display_name) like '%' || v_escaped || '%' escape '\'
          or lower(p.slug) like '%' || v_escaped || '%' escape '\'
        )
      )
      -- Whole handle, exactly: no more than the URL already gives them. Plain
      -- equality, so nothing here needs escaping.
      or lower(p.slug) = v_needle
    )
  order by
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
