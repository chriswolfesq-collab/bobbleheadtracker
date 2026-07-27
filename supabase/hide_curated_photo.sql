-- Lets an admin clear a curated listing's build-time seed photo (the imageUrl
-- baked into data/giveaways/*.json — see the photos added in a8a8fbf). There's
-- no approved_photos row behind those, so "Remove current photo" had nothing to
-- delete and the button stayed hidden. This flag is the tombstone that lets the
-- detail and team pages skip the seed image without a redeploy.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL editor.

alter table public.bobblehead_overrides
  add column if not exists photo_hidden boolean not null default false;
