-- Adds the Oakland/Sacramento choice to Athletics bobbleheads.
--
-- The franchise's last Oakland season was 2024 and 2025 on is West Sacramento,
-- so a listing's year already gives the right answer for the whole back
-- catalog. This column records an explicit pick when someone needs to differ
-- from that; null means "go by the year" (see lib/athleticsCity.ts).
--
-- Curated listings keep it on their override row, community listings on the row
-- itself. Nothing else in the catalog has a city split, so the column stays
-- null for every other team.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.

alter table public.bobblehead_overrides
  add column if not exists city text;

alter table public.bobblehead_overrides drop constraint if exists bobblehead_overrides_city_check;
alter table public.bobblehead_overrides
  add constraint bobblehead_overrides_city_check
  check (city is null or city in ('Oakland', 'Sacramento'));

alter table public.community_bobbleheads
  add column if not exists city text;

alter table public.community_bobbleheads drop constraint if exists community_bobbleheads_city_check;
alter table public.community_bobbleheads
  add constraint community_bobbleheads_city_check
  check (city is null or city in ('Oakland', 'Sacramento'));
