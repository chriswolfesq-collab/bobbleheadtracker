-- Opt-in public wanted list on a shared shelf.
-- Run once in the Supabase SQL editor; safe to re-run.
--
-- supabase/gallery.sql deliberately kept wanted rows out of the public gallery:
-- who-wants-what is the basis of the private "new owner" trade alerts
-- (supabase/wishlist_alerts.sql), and a wanted list leaking by default would
-- undo that design. Nothing here changes that default. What it adds is a third
-- switch, off until its owner flips it, for the collector who wants the
-- opposite: a shelf link that doubles as a wish list, so someone who is not on
-- the site at all — a spouse standing in front of a marketplace listing — can
-- see what they're still hunting for. Asked for on the board 2026-08-31.
--
-- Deliberately independent of gallery_public rather than folded into it: the
-- wish-list use case is "show what I don't have", which is a different thing to
-- disclose than "show everything I do have", and a collector should be able to
-- publish either one without the other.

-- ---------------------------------------------------------------------------
-- Preference (off by default)
-- ---------------------------------------------------------------------------

-- Third flag alongside is_public and gallery_public. Default false: a wanted
-- list is a shopping list with your name on it, so it's opt-in on top of an
-- already-public shelf, never implied by it.
alter table public.profiles
  add column if not exists wanted_public boolean not null default false;

-- ---------------------------------------------------------------------------
-- Preference setter
-- ---------------------------------------------------------------------------
-- profiles has no client update policy (see schema.sql), so the toggle goes
-- through a SECURITY DEFINER RPC, same shape as set_gallery_public().
create or replace function public.set_wanted_public(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Defensive insert, matching set_gallery_public: the sync_profile_from_auth
  -- trigger makes this row at signup, but re-create it if it's somehow missing
  -- rather than silently no-op'ing the user's choice.
  insert into public.profiles (id, wanted_public)
  values (auth.uid(), coalesce(p_enabled, false))
  on conflict (id) do update
    set wanted_public = coalesce(p_enabled, false),
        updated_at = now();
end;
$$;

revoke all on function public.set_wanted_public(boolean) from public, anon;
grant execute on function public.set_wanted_public(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Public read surface
-- ---------------------------------------------------------------------------
-- Replaces the get_public_gallery from supabase/gallery.sql. Same contract —
-- rows only for a public shelf, nothing for an unknown slug, so a visitor still
-- can't tell a private shelf from one that doesn't exist — with the two opt-ins
-- now applied per kind: gallery_public governs owned + favorites exactly as
-- before, and wanted_public governs the wanted rows on their own. A profile
-- that has never touched either switch returns nothing, which is the same
-- answer this function gave before this file existed.
create or replace function public.get_public_gallery(p_slug text)
returns table (bobblehead_id text, team_slug text, kind text)
language sql
stable
security definer
set search_path = public
as $$
  with owner as (
    select id, gallery_public, wanted_public
    from public.profiles
    where slug = p_slug and is_public
  )
  select c.bobblehead_id, c.team_slug, 'owned'::text
  from public.user_collections c
  join owner o on o.id = c.user_id
  where c.owned and o.gallery_public
  union all
  select f.bobblehead_id, f.team_slug, 'favorite'::text
  from public.user_favorites f
  join owner o on o.id = f.user_id
  where f.favorited and o.gallery_public
  union all
  select w.bobblehead_id, w.team_slug, 'wanted'::text
  from public.user_wants w
  join owner o on o.id = w.user_id
  where w.wanted and o.wanted_public;
$$;

grant execute on function public.get_public_gallery(text) to anon, authenticated;
