-- Every shelf is public. The public/private toggle is gone from the app, so
-- the slug is minted at signup instead of at first opt-in, every existing
-- profile is backfilled and flipped public, and disable_public_shelf() is
-- dropped so nothing can flip one back.
--
-- profiles.is_public stays as a column because get_public_shelf,
-- get_public_gallery, and the friends RPCs all filter on it; it is now simply
-- always true, and none of those functions need to change.

-- Minting, shared by the signup trigger and the backfill below. Same
-- suffix-loop enable_public_shelf() uses: two collectors with the same name
-- get "-2", "-3", and so on. Unlike enable_public_shelf this runs inside the
-- signup trigger, where an exception would abort the signup itself — so a
-- lost race on the unique slug index is retried here rather than surfaced.
create or replace function public.assign_shelf_slug(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_base text;
  v_candidate text;
  v_suffix int := 2;
begin
  select slug into v_slug from public.profiles where id = p_user_id;
  if v_slug is not null then
    return;
  end if;

  select public.slugify(display_name) into v_base
  from public.profiles where id = p_user_id;
  if v_base is null or v_base = '' then
    return;
  end if;

  for v_attempt in 1..3 loop
    v_candidate := v_base;
    while exists (select 1 from public.profiles where slug = v_candidate) loop
      v_candidate := v_base || '-' || v_suffix;
      v_suffix := v_suffix + 1;
    end loop;

    begin
      update public.profiles
         set slug = v_candidate,
             updated_at = now()
       where id = p_user_id;
      return;
    exception when unique_violation then
      -- A same-named signup took the candidate between the loop and the
      -- write; bump past it and try again.
      v_suffix := v_suffix + 1;
    end;
  end loop;
  -- Three straight losses: leave slug null. The next display-name sync
  -- re-runs this function and picks it up.
end;
$$;

-- Recreated in full from avatars.sql — the current version of this function
-- lives there, and dropping its avatar mirror would silently stop profile
-- photos syncing. Only the slug mint at the end is new; the insert guard and
-- its member-number reasoning are explained in awards.sql, where the function
-- was born. Needs: avatars.sql.
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = new.id) then
    insert into public.profiles (id, display_name, member_number)
    values (
      new.id,
      public.display_name_of(new.raw_user_meta_data),
      nextval('public.profiles_member_number_seq')
    )
    on conflict (id) do nothing;
  end if;

  update public.profiles
     set display_name = public.display_name_of(new.raw_user_meta_data),
         avatar_path = case
           when new.raw_user_meta_data ->> 'avatar_path'
                ~ ('^' || new.id::text || '/[A-Za-z0-9._-]+$')
           then new.raw_user_meta_data ->> 'avatar_path'
           else null
         end,
         updated_at = now()
   where id = new.id;

  -- No-op once a slug exists, so renaming yourself still never changes your
  -- shelf URL.
  perform public.assign_shelf_slug(new.id);

  return new;
end;
$$;

-- Backfill: accounts that never flipped the old toggle have no slug yet.
do $$
declare
  r record;
begin
  for r in select id from public.profiles where slug is null loop
    perform public.assign_shelf_slug(r.id);
  end loop;
end;
$$;

update public.profiles set is_public = true where not is_public;

alter table public.profiles alter column is_public set default true;

-- enable_public_shelf() stays: cached bundles from before this change still
-- call it from the old share dialog, and it's now a harmless no-op that
-- returns the slug. disable_public_shelf() goes — with the toggle gone
-- nothing legitimate calls it, and leaving it would let any signed-in session
-- make itself invisible from the browser console.
drop function if exists public.disable_public_shelf();

-- Recreated in full from friends.sql — the current version of this function
-- now lives here. Only the gallery_public gate is new; the id-only column list
-- and the wanted-list reasoning are explained where it was born (friends.sql).
--
-- Why it needed one: this RPC checked is_public and friendship but never
-- gallery_public, unlike get_public_gallery. That was survivable while
-- is_public was a real switch — turning sharing off hid a shelf from everyone,
-- friends included. With is_public permanently true that escape hatch is gone,
-- and a friend would see the full owned list, favorites AND the wanted list
-- even from an owner who had "Show my items" switched off. Gating on the same
-- flag the public gallery uses puts that back under the owner's control, and
-- keeps one switch governing every surface that shows items rather than two
-- that disagree.
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
      and p.gallery_public
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

-- friends.sql revoked these and granted to authenticated; create or replace
-- keeps the existing grants, but re-assert them so a fresh run of this file on
-- a database that somehow lost them ends up in the same place.
revoke all on function public.get_friend_gallery(text) from public, anon;
grant execute on function public.get_friend_gallery(text) to authenticated;
