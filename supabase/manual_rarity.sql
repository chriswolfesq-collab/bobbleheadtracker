-- Rarity becomes a field an admin sets, not something derived from the quantity
-- issued. The old rule (under 10,000 = Ultra Rare, and so on) mislabeled a lot
-- of the catalog: rarity is demand and resale-market availability as much as
-- print run, and a piece with no quantity on record could never be flagged at
-- all no matter how scarce it actually is.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL editor.
--
-- 1. Rarity columns on the two tables that carry bobblehead text fields.
--    Curated listings store it on the override row, community listings on the
--    listing itself. Null means "no rarity set" — no badge, which is the
--    default for every listing until someone marks it.
--
--    `rarity_note` is the stated reason, shown under the badge on the detail
--    page ("Fewer than 200 known to exist", "Never surfaces on eBay"). Optional:
--    without one the page says the badge was set by the BobbleShelf team.

alter table public.bobblehead_overrides
  add column if not exists rarity text;

alter table public.bobblehead_overrides
  add column if not exists rarity_note text;

alter table public.community_bobbleheads
  add column if not exists rarity text;

alter table public.community_bobbleheads
  add column if not exists rarity_note text;

-- 2. Only the three tiers the UI knows how to render. Anything else would come
--    out of lib/rarity.ts as null and silently lose the badge, so reject it at
--    the door instead.

alter table public.bobblehead_overrides drop constraint if exists bobblehead_overrides_rarity_check;
alter table public.bobblehead_overrides
  add constraint bobblehead_overrides_rarity_check
  check (rarity is null or rarity in ('ultra-rare', 'rare', 'limited'));

alter table public.community_bobbleheads drop constraint if exists community_bobbleheads_rarity_check;
alter table public.community_bobbleheads
  add constraint community_bobbleheads_rarity_check
  check (rarity is null or rarity in ('ultra-rare', 'rare', 'limited'));
