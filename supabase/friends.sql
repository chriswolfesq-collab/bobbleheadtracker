-- Friends: a mutual, accepted relationship that upgrades what two collectors
-- can see of each other. A friend sees the FULL shelf — every owned
-- bobblehead, favorites, and the wanted list — where a stranger sees only the
-- shared summary (and the opt-in public gallery, if any).
--
-- Friendship upgrades a shared shelf; it never resurrects a private one. Every
-- friend-facing read still requires the owner's is_public flag, so "turn
-- sharing off" remains the one kill switch that hides everything from
-- everyone, friends included. Collection details (condition, price paid,
-- notes) stay owner-only: the gallery RPC projects id columns exactly like
-- get_public_gallery, and nothing here adds an RLS policy to the per-user
-- tables — a row policy can't hide columns, so a friend-select policy on
-- user_collections would have leaked price_paid on day one.
--
-- Addressing is by shelf slug: the only way members find each other today is
-- a shared /shelf/<slug> link, so that link is also how you ask. An unknown
-- slug and a private shelf produce the same refusal, preserving the site's
-- "you can't probe who has an account" stance (schema.sql's profiles notes).
--
-- The table carries one row per pair, keyed by who asked. RLS is enabled with
-- NO policies — reads and writes go through the security definer RPCs below,
-- the same posture as photo_votes: the profile join for names/avatars has to
-- happen server-side (profiles is owner-read-only), and every state change
-- has invariants to hold.
--
-- Needs: schema.sql, avatars.sql (profiles.avatar_path in list_friendships).

-- ---------------------------------------------------------------------------
-- Part 1: the table
-- ---------------------------------------------------------------------------

create table if not exists public.friendships (
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists friendships_addressee_idx
  on public.friendships (addressee_id);

alter table public.friendships enable row level security;

-- ---------------------------------------------------------------------------
-- Part 2: asking
-- ---------------------------------------------------------------------------
-- Returns what happened rather than raising for the benign cases, so the
-- button can show "request sent" / "you're already friends" without parsing
-- error strings. Declines are deletes, not a status — a declined request
-- leaves no row, so the asker can ask again later and the decliner never has
-- to explain themselves.

create or replace function public.send_friend_request(p_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
  v_recent int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select id into v_target
  from public.profiles
  where slug = p_slug and is_public;

  -- Unknown slug and gone-private shelf produce the same message, on purpose.
  if v_target is null then
    raise exception 'No shared shelf found at that link.';
  end if;

  if v_target = auth.uid() then
    raise exception 'That''s your own shelf.';
  end if;

  if exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = v_target)
        or (requester_id = v_target and addressee_id = auth.uid()))
  ) then
    return 'already_friends';
  end if;

  if exists (
    select 1 from public.friendships
    where requester_id = auth.uid() and addressee_id = v_target and status = 'pending'
  ) then
    return 'already_pending';
  end if;

  -- They already asked you: asking back is an answer, not a second question.
  update public.friendships
     set status = 'accepted', responded_at = now()
   where requester_id = v_target and addressee_id = auth.uid() and status = 'pending';
  if found then
    return 'accepted';
  end if;

  -- Same shape and SQLSTATE as the other limits (lib/rateLimit.ts). Deleted
  -- (declined/cancelled) rows escape the count; 30 an hour still buries any
  -- honest use and starves a pesterer.
  select count(*) into v_recent
  from public.friendships
  where requester_id = auth.uid() and created_at > now() - interval '1 hour';
  if v_recent >= 30 then
    raise exception 'That''s a lot of friend requests in one hour. Take a breather and try again shortly.'
      using errcode = 'BB429';
  end if;

  insert into public.friendships (requester_id, addressee_id)
  values (auth.uid(), v_target);

  return 'pending';
end;
$$;

-- ---------------------------------------------------------------------------
-- Part 3: answering, taking back, ending
-- ---------------------------------------------------------------------------

create or replace function public.respond_friend_request(p_requester uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  if p_accept then
    update public.friendships
       set status = 'accepted', responded_at = now()
     where requester_id = p_requester and addressee_id = auth.uid() and status = 'pending';
    if not found then
      raise exception 'That request isn''t there any more.';
    end if;
  else
    delete from public.friendships
    where requester_id = p_requester and addressee_id = auth.uid() and status = 'pending';
  end if;
end;
$$;

create or replace function public.cancel_friend_request(p_addressee uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.friendships
  where requester_id = auth.uid() and addressee_id = p_addressee and status = 'pending';
$$;

create or replace function public.remove_friend(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.friendships
  where status = 'accepted'
    and ((requester_id = auth.uid() and addressee_id = p_user_id)
      or (requester_id = p_user_id and addressee_id = auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- Part 4: reading
-- ---------------------------------------------------------------------------
-- Everything the Friends tab renders, one round trip: each row is the OTHER
-- person on a friendship involving the caller, joined server-side to profiles
-- for name/avatar/slug — the join a client can't do itself under profiles'
-- owner-only RLS. slug/is_public ride along so the list can link to shelves
-- that are still shared and skip linking ones that went private.

create or replace function public.list_friendships()
returns table (
  user_id uuid,
  display_name text,
  avatar_path text,
  slug text,
  is_public boolean,
  direction text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    other.id,
    other.display_name,
    other.avatar_path,
    other.slug,
    other.is_public,
    case when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
    f.status,
    f.created_at
  from public.friendships f
  join public.profiles other
    on other.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id)
  order by f.created_at desc;
$$;

-- Where the caller stands with one shelf, for the button on /shelf/<slug>.
-- owner_id rides along because accepting from that page needs the requester's
-- id (user ids already appear in public avatar URLs; they are not a secret).
create or replace function public.friend_shelf_status(p_slug text)
returns table (status text, owner_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with owner as (
    select id from public.profiles where slug = p_slug and is_public
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
    o.id
  from (select (select id from owner) as id) o;
$$;

-- The full shelf, for friends: same shape and same explicit id-only column
-- list as get_public_gallery, plus the wanted list — the thing the refer page
-- promises pays off ("wanted lists only work when there's someone on the other
-- end"). Requires BOTH the owner's is_public and an accepted friendship with
-- the caller; either missing yields zero rows, indistinguishable from an empty
-- shelf.

create or replace function public.get_friend_gallery(p_slug text)
returns table (bobblehead_id text, team_slug text, kind text)
language sql
stable
security definer
set search_path = public
as $$
  with owner as (
    select p.id
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
  where c.owned
  union all
  select f.bobblehead_id, f.team_slug, 'favorite'::text
  from public.user_favorites f join owner o on o.id = f.user_id
  where f.favorited
  union all
  select w.bobblehead_id, w.team_slug, 'wanted'::text
  from public.user_wants w join owner o on o.id = w.user_id
  where w.wanted;
$$;

-- ---------------------------------------------------------------------------
-- Grants — signed-in members only, nothing for anon
-- ---------------------------------------------------------------------------

revoke all on function public.send_friend_request(text) from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.cancel_friend_request(uuid) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
revoke all on function public.list_friendships() from public, anon;
revoke all on function public.friend_shelf_status(text) from public, anon;
revoke all on function public.get_friend_gallery(text) from public, anon;

grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.list_friendships() to authenticated;
grant execute on function public.friend_shelf_status(text) to authenticated;
grant execute on function public.get_friend_gallery(text) to authenticated;
