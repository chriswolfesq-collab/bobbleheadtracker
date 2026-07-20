-- Opt-in browsable gallery on the public shelf.
-- Run once in the Supabase SQL editor; safe to re-run.
--
-- By default a public shelf shows only per-team counts (get_public_shelf): what
-- specific bobbleheads someone owns stays private even when they share. This
-- adds a second, separate opt-in — gallery_public — that lets a collector who
-- has already made their shelf public also show the actual items: the
-- bobbleheads they own and the ones they've favorited. Counts-only remains the
-- default; a collector has to turn this on deliberately, on top of sharing.
--
-- Wishlist/wanted items are deliberately NOT exposed here. They're the basis of
-- the private "new owner" trade alerts (supabase/wishlist_alerts.sql), where the
-- whole design keeps who-wants-what invisible to other collectors.

-- ---------------------------------------------------------------------------
-- Preference (off by default)
-- ---------------------------------------------------------------------------

-- Second flag alongside is_public. Default false: showing your items is strictly
-- more revealing than showing counts, so it's opt-in on top of an already-public
-- shelf, never implied by it.
alter table public.profiles
  add column if not exists gallery_public boolean not null default false;

-- ---------------------------------------------------------------------------
-- Preference setter
-- ---------------------------------------------------------------------------
-- profiles has no client update policy (see schema.sql — letting the client
-- write it directly would let it pick its own slug), so the toggle goes through
-- a SECURITY DEFINER RPC, same shape as set_wishlist_alerts() / enable_public_shelf().
create or replace function public.set_gallery_public(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Defensive insert: the sync_profile_from_auth trigger makes this row at
  -- signup, but re-create it if it's somehow missing rather than silently
  -- no-op'ing the user's choice.
  insert into public.profiles (id, gallery_public)
  values (auth.uid(), coalesce(p_enabled, false))
  on conflict (id) do update
    set gallery_public = coalesce(p_enabled, false),
        updated_at = now();
end;
$$;

revoke all on function public.set_gallery_public(boolean) from public, anon;
grant execute on function public.set_gallery_public(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Public read surface for the gallery
-- ---------------------------------------------------------------------------
-- Companion to get_public_shelf: returns the owner's actual owned and favorited
-- bobblehead_id rows, but ONLY when the shelf is public AND the gallery opt-in
-- is on. Both conditions live in the owner CTE, so a private shelf or an
-- un-opted-in one returns no rows and the page shows no gallery — the same
-- can't-tell-them-apart behaviour as get_public_shelf. Never exposes wanted rows.
create or replace function public.get_public_gallery(p_slug text)
returns table (bobblehead_id text, team_slug text, kind text)
language sql
stable
security definer
set search_path = public
as $$
  with owner as (
    select id
    from public.profiles
    where slug = p_slug and is_public and gallery_public
  )
  select c.bobblehead_id, c.team_slug, 'owned'::text
  from public.user_collections c
  join owner o on o.id = c.user_id
  where c.owned
  union all
  select f.bobblehead_id, f.team_slug, 'favorite'::text
  from public.user_favorites f
  join owner o on o.id = f.user_id
  where f.favorited;
$$;

grant execute on function public.get_public_gallery(text) to anon, authenticated;
