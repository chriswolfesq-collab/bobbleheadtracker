-- A friends-only visibility switch, separate from the public one.
--
-- The story so far. all_shelves_public.sql gated the whole friend gallery on
-- gallery_public ("Show my items") so a friend could never see more than the
-- public — closing a real hole, since a friend was otherwise getting owned
-- items, favorites AND the wanted list from someone who had turned item
-- sharing off. Then 72d5a98 moved that gate from the shared CTE onto the
-- individual branches, freeing the wanted list: it is not public and cannot be
-- (get_public_gallery can't emit it), so hanging it off a public-shelf switch
-- was a category error.
--
-- What was still missing is a way to say "the whole internet doesn't get my
-- items, but the eleven people whose friend requests I accepted do." That was
-- one question answered by one switch built for a different audience, and with
-- gallery_public off on 42 of 47 profiles it meant accepting a friend bought
-- almost nobody anything beyond wants. This adds the second switch.
--
-- The change here is strictly additive. The wanted list stays exactly as
-- 72d5a98 left it — friendship only, no item gate. owned and favorites now
-- reach a friend when EITHER the public switch or the new friends switch is
-- on, so nothing that was visible stops being visible and the public shelf is
-- untouched.
--
-- On the default: this one is ON where gallery_public is OFF, because they are
-- different consent questions. gallery_public publishes to anyone holding a
-- link, so silence has to mean no. friends_see_items only ever applies to
-- someone the owner personally accepted — mutual, affirmative, revocable — so
-- defaulting it on is what makes accepting a friend request mean what the
-- accept screen says it means. Nothing becomes visible to anyone the moment
-- this runs: there are zero accepted friendships, so every disclosure still
-- waits on an owner pressing Accept. Anyone who wants friendship to carry less
-- turns this off on /settings, where it sits directly under the public switch.
--
-- Idempotent — safe to run more than once. Needs friends.sql and the
-- per-branch get_friend_gallery from 72d5a98.

-- ---------------------------------------------------------------------------
-- Part 1: the column
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists friends_see_items boolean not null default true;

-- ---------------------------------------------------------------------------
-- Part 2: the setter
-- ---------------------------------------------------------------------------
-- profiles has no client UPDATE policy by design (schema.sql), so this follows
-- set_gallery_public's shape exactly.

create or replace function public.set_friends_see_items(p_enabled boolean)
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
     set friends_see_items = p_enabled,
         updated_at = now()
   where id = auth.uid();
end;
$$;

revoke all on function public.set_friends_see_items(boolean) from public, anon;
grant execute on function public.set_friends_see_items(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Part 3: let the friends switch open owned and favorites
-- ---------------------------------------------------------------------------
-- Keeps 72d5a98's per-branch shape. The only edit is `and o.gallery_public`
-- becoming `and (o.gallery_public or o.friends_see_items)` on the two branches
-- that have a public equivalent. The wanted branch still carries no item gate.

create or replace function public.get_friend_gallery(p_slug text)
returns table (bobblehead_id text, team_slug text, kind text)
language sql
stable
security definer
set search_path = public
as $$
  with owner as (
    select p.id, p.gallery_public, p.friends_see_items
    from public.profiles p
    where p.slug = p_slug
      and p.is_public
      and exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and ((f.requester_id = p.id and f.addressee_id = auth.uid())
            or (f.addressee_id = p.id and f.requester_id = auth.uid()))
      )
  )
  select c.bobblehead_id, c.team_slug, 'owned'::text
  from public.user_collections c join owner o on o.id = c.user_id
  where c.owned and (o.gallery_public or o.friends_see_items)
  union all
  select f.bobblehead_id, f.team_slug, 'favorite'::text
  from public.user_favorites f join owner o on o.id = f.user_id
  where f.favorited and (o.gallery_public or o.friends_see_items)
  union all
  -- Friendship only, unchanged: a wanted list has no public form to exceed.
  select w.bobblehead_id, w.team_slug, 'wanted'::text
  from public.user_wants w join owner o on o.id = w.user_id
  where w.wanted;
$$;

-- ---------------------------------------------------------------------------
-- Part 4: let the shelf page say which switch is off
-- ---------------------------------------------------------------------------
-- Adds owner_shares_with_friends — "will a friend see this owner's items?",
-- which is the OR of the two switches, not the new one alone. The panel uses it
-- to explain an empty gallery instead of guessing. Recreated rather than
-- altered because the return type changes; the drop is what forces the grant to
-- be repeated below (create function grants execute to public by default).

drop function if exists public.friend_shelf_status(text);

create function public.friend_shelf_status(p_slug text)
returns table (status text, owner_id uuid, owner_shares_with_friends boolean)
language sql
stable
security definer
set search_path = public
as $$
  with owner as (
    select id, (gallery_public or friends_see_items) as shares_items
    from public.profiles
    where slug = p_slug and is_public
  )
  select
    case
      when o.id is null then 'none'
      when o.id = auth.uid() then 'self'
      when exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and ((f.requester_id = auth.uid() and f.addressee_id = o.id)
            or (f.requester_id = o.id and f.addressee_id = auth.uid()))
      ) then 'friends'
      when exists (
        select 1 from public.friendships f
        where f.requester_id = auth.uid() and f.addressee_id = o.id and f.status = 'pending'
      ) then 'pending_out'
      when exists (
        select 1 from public.friendships f
        where f.requester_id = o.id and f.addressee_id = auth.uid() and f.status = 'pending'
      ) then 'pending_in'
      else 'none'
    end,
    o.id,
    coalesce(o.shares_items, false)
  from (
    select (select id from owner) as id, (select shares_items from owner) as shares_items
  ) o;
$$;

revoke all on function public.friend_shelf_status(text) from public, anon;
grant execute on function public.friend_shelf_status(text) to authenticated;
