-- The same collision that hit approved_photos on 2026-07-27 (see
-- supabase/fix_photo_team_collisions.sql), one table over: user_collections,
-- user_favorites and user_wants are all keyed (user_id, bobblehead_id), but
-- curated ids repeat across teams — 36 of them, "jeff-conine-2003" among them
-- (Marlins AND Orioles).
--
-- Reported by the Marlins rep on 2026-08-03: marking the Orioles Jeff Conine
-- owned cleared the owned label on the Marlins one. The client already sends
-- team_slug and reads back with .eq("team_slug", …); it's the upsert that
-- collides. With only (user_id, bobblehead_id) unique, the second toggle
-- conflicts with the first team's row and UPDATEs it in place, rewriting
-- team_slug — so the row doesn't just stop being owned on the first team, it
-- moves to the second one. Both the owned/wanted/favorited toggles and the CSV
-- import go through that upsert.
--
-- Fix: key all three tables by (user_id, team_slug, bobblehead_id). The old key
-- is strictly stricter than the new one, so no duplicates can exist yet and the
-- key swap can't fail on existing data.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL editor.
-- Run this BEFORE deploying the matching code change (the client upserts now
-- pass onConflict: "user_id,team_slug,bobblehead_id", which needs this key).
--
-- NOT repairable: a toggle that landed on the wrong team overwrote the earlier
-- row with no record of what it replaced, so there's nothing to restore from.
-- Affected fans (only ever on the 36 colliding ids) need to re-mark the listing
-- on the team that lost it. It stays marked from here on.

do $$
declare
  t text;
begin
  foreach t in array array['user_collections', 'user_favorites', 'user_wants'] loop
    if exists (
      select 1 from pg_constraint
      where conrelid = ('public.' || t)::regclass
        and contype = 'p'
        and array_length(conkey, 1) = 2
    ) then
      execute format('alter table public.%I drop constraint %I', t, t || '_pkey');
      execute format('alter table public.%I add primary key (user_id, team_slug, bobblehead_id)', t);
    end if;
  end loop;
end $$;
