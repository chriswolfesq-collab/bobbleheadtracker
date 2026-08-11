-- ---------------------------------------------------------------------------
-- Remove 12 community listings that duplicate a curated listing
-- ---------------------------------------------------------------------------
-- Each row below is a community submission with the same team, title and date
-- as a bobblehead already in data/giveaways/*.json, so both render as separate
-- cards on the team page (verified live on /teams/rockies and /teams/rays).
-- All twelve were approved in one batch on 2026-07-14/15, so the duplicate
-- warning in lib/duplicateCheck.ts was clicked past rather than missed — the
-- matcher catches all twelve on exact title + nickname.
--
-- The curated twin is the keeper: it carries the seed photo, the quantity, and
-- the stable id that collection marks and permalinks already point at. The
-- community row is what goes.
--
-- Run this in the Supabase SQL editor, as two separate blocks: BLOCK A first,
-- read its output, then BLOCK B. Each block is self-contained and repeats the
-- pair list, so it does not matter which connection the editor hands you.
--
-- This does NOT use public.admin_delete_bobblehead(): that function gates on
-- can_edit_team(), which reads auth.uid() — null in the SQL editor, so the call
-- would just raise 'not authorized'. BLOCK B mirrors what that function does
-- for p_source = 'community', with three deliberate additions (steps 1–3) that
-- the function does not do.

-- ===========================================================================
-- BLOCK A — pre-flight. Run this alone and read the output. Changes nothing.
-- ===========================================================================
-- Checked with the anon key beforehand: bobblehead_gallery_photos and
-- approved_photos hold nothing for these ids (both are public-read, so an empty
-- result there is trustworthy). user_collections / user_favorites / user_wants
-- are owner-select only under RLS, so an anon read of them proves nothing —
-- this query, run as the dashboard's superuser role, is the real check.
--
-- What to look for:
--   * rows returned must be 12. Fewer means a row is already gone or an id has
--     drifted — stop and re-check rather than running BLOCK B.
--   * title/date must match the curated twin you expect to keep.
--   * if owned/favorited/wanted are all 0, steps 2 and 3 of BLOCK B are no-ops.
--     If any are non-zero, keep them: they move those marks onto the curated
--     twin so nobody silently loses a bobblehead off their shelf.

with dupe_pairs (team_slug, community_id, curated_id) as (values
  ('blue-jays', 'community-blue-jays-lyle-overbay-1359e954',        'lyle-overbay-2009'),
  ('braves',    'community-braves-eddie-rosario-nlcs-mvp-3a7ca824', 'eddie-rosario-nlcs-mvp-2022'),
  ('mariners',  'community-mariners-julio-rodriguez-465e7cc4',      'julio-rodriguez-2024'),
  ('orioles',   'community-orioles-sammy-sosa-a0e4a74c',            'sammy-sosa-2005'),
  ('pirates',   'community-pirates-zach-duke-af84733f',             'zach-duke-2006'),
  ('rays',      'community-rays-shane-mcclanahan-3032fd04',         'shane-mcclanahan-2023'),
  ('rays',      'community-rays-taj-bradley-be8de7d0',              'taj-bradley-2025'),
  ('red-sox',   'community-red-sox-david-ortiz-53d3c2d7',           'david-ortiz-2014'),
  ('reds',      'community-reds-bronson-arroyo-d3cf789f',           'bronson-arroyo-2023'),
  ('reds',      'community-reds-eugenio-suarez-e0371247',           'eugenio-suarez-2018'),
  ('rockies',   'community-rockies-todd-helton-66554b0b',           'todd-helton-2024'),
  ('rockies',   'community-rockies-trevor-story-58b30235',          'trevor-story-2019')
)
select
  p.team_slug,
  p.community_id,
  p.curated_id,
  cb.title,
  cb.date,
  (select count(*) from public.user_collections c
     where c.bobblehead_id = p.community_id and c.team_slug = p.team_slug) as owned,
  (select count(*) from public.user_favorites f
     where f.bobblehead_id = p.community_id and f.team_slug = p.team_slug) as favorited,
  (select count(*) from public.user_wants w
     where w.bobblehead_id = p.community_id and w.team_slug = p.team_slug) as wanted,
  (select count(*) from public.submissions s
     where s.target_bobblehead_id = p.community_id
       and s.team_slug = p.team_slug and s.status = 'pending')             as pending_subs,
  cb.image_url
from dupe_pairs p
left join public.community_bobbleheads cb
  on cb.id = p.community_id and cb.team_slug = p.team_slug
order by p.team_slug, p.community_id;

-- ===========================================================================
-- BLOCK B — the deletion. Run as one block, after BLOCK A looks right.
-- ===========================================================================
-- The editor runs this whole block and commits at the end, so the STEP 6
-- check below is a receipt, not a gate. To gate on it instead: delete the
-- final `commit;` line, run the block (the transaction stays open on that
-- connection), read the STEP 6 result, then send `commit;` or `rollback;` as
-- the next statement in the same editor tab.

begin;

create temporary table dupe_pairs (
  team_slug     text not null,
  community_id  text not null,
  curated_id    text not null
) on commit drop;

insert into dupe_pairs (team_slug, community_id, curated_id) values
  ('blue-jays', 'community-blue-jays-lyle-overbay-1359e954',        'lyle-overbay-2009'),
  ('braves',    'community-braves-eddie-rosario-nlcs-mvp-3a7ca824', 'eddie-rosario-nlcs-mvp-2022'),
  ('mariners',  'community-mariners-julio-rodriguez-465e7cc4',      'julio-rodriguez-2024'),
  ('orioles',   'community-orioles-sammy-sosa-a0e4a74c',            'sammy-sosa-2005'),
  ('pirates',   'community-pirates-zach-duke-af84733f',             'zach-duke-2006'),
  ('rays',      'community-rays-shane-mcclanahan-3032fd04',         'shane-mcclanahan-2023'),
  ('rays',      'community-rays-taj-bradley-be8de7d0',              'taj-bradley-2025'),
  ('red-sox',   'community-red-sox-david-ortiz-53d3c2d7',           'david-ortiz-2014'),
  ('reds',      'community-reds-bronson-arroyo-d3cf789f',           'bronson-arroyo-2023'),
  ('reds',      'community-reds-eugenio-suarez-e0371247',           'eugenio-suarez-2018'),
  ('rockies',   'community-rockies-todd-helton-66554b0b',           'todd-helton-2024'),
  ('rockies',   'community-rockies-trevor-story-58b30235',          'trevor-story-2019');

-- Abort rather than half-apply if the live rows no longer match BLOCK A.
do $$
declare
  v_found int;
begin
  select count(*) into v_found
  from dupe_pairs p
  join public.community_bobbleheads cb
    on cb.id = p.community_id and cb.team_slug = p.team_slug;

  if v_found <> 12 then
    raise exception 'expected 12 duplicate rows, found % — re-run BLOCK A', v_found;
  end if;
end;
$$;

-- STEP 1 — keep the fan photo.
-- Every one of the twelve carries a user-submitted photo in the
-- bobblehead-approved storage bucket. Deleting the row alone would orphan that
-- object and lose a real photo of a real bobblehead, so re-file it onto the
-- curated twin's gallery first. Additive and non-destructive: the curated
-- listing keeps its own seed photo and gains this as a gallery shot.
-- Drop this statement if you would rather discard the photos.
insert into public.bobblehead_gallery_photos (bobblehead_id, team_slug, image_url, approved_by)
select p.curated_id, p.team_slug, cb.image_url, cb.approved_by
from dupe_pairs p
join public.community_bobbleheads cb
  on cb.id = p.community_id and cb.team_slug = p.team_slug
where cb.image_url is not null
  and not exists (
    select 1 from public.bobblehead_gallery_photos g
    where g.bobblehead_id = p.curated_id
      and g.team_slug = p.team_slug
      and g.image_url = cb.image_url
  );

-- STEP 2 — move collection marks onto the curated twin.
-- admin_delete_bobblehead() would simply drop these. Since an identical
-- listing survives, moving them is the honest outcome: a user who marked the
-- duplicate as owned still owns that bobblehead. ON CONFLICT DO NOTHING covers
-- the user who had already marked both copies.
insert into public.user_collections (user_id, bobblehead_id, team_slug, owned, condition, acquired_on, price_paid, notes, updated_at)
select c.user_id, p.curated_id, p.team_slug, c.owned, c.condition, c.acquired_on, c.price_paid, c.notes, c.updated_at
from dupe_pairs p
join public.user_collections c
  on c.bobblehead_id = p.community_id and c.team_slug = p.team_slug
on conflict (user_id, team_slug, bobblehead_id) do nothing;

insert into public.user_favorites (user_id, bobblehead_id, team_slug, favorited, updated_at)
select f.user_id, p.curated_id, p.team_slug, f.favorited, f.updated_at
from dupe_pairs p
join public.user_favorites f
  on f.bobblehead_id = p.community_id and f.team_slug = p.team_slug
on conflict (user_id, team_slug, bobblehead_id) do nothing;

insert into public.user_wants (user_id, bobblehead_id, team_slug, wanted, updated_at)
select w.user_id, p.curated_id, p.team_slug, w.wanted, w.updated_at
from dupe_pairs p
join public.user_wants w
  on w.bobblehead_id = p.community_id and w.team_slug = p.team_slug
on conflict (user_id, team_slug, bobblehead_id) do nothing;

-- STEP 3 — repoint pending submissions at the survivor.
-- admin_delete_bobblehead() rejects these outright. Repointing is kinder: a fan
-- who sent in a photo of this bobblehead sent in a photo of a bobblehead that
-- still exists, so their submission stays reviewable. Only photo_for_existing
-- submissions carry a target_bobblehead_id, so only those are touched.
update public.submissions s
set target_bobblehead_id = p.curated_id
from dupe_pairs p
where s.target_bobblehead_id = p.community_id
  and s.team_slug = p.team_slug
  and s.status = 'pending';

-- STEP 4 — clear everything still hanging off the doomed rows.
delete from public.user_collections c
using dupe_pairs p
where c.bobblehead_id = p.community_id and c.team_slug = p.team_slug;

delete from public.user_favorites f
using dupe_pairs p
where f.bobblehead_id = p.community_id and f.team_slug = p.team_slug;

delete from public.user_wants w
using dupe_pairs p
where w.bobblehead_id = p.community_id and w.team_slug = p.team_slug;

delete from public.approved_photos a
using dupe_pairs p
where a.bobblehead_id = p.community_id and a.team_slug = p.team_slug;

delete from public.bobblehead_gallery_photos g
using dupe_pairs p
where g.bobblehead_id = p.community_id and g.team_slug = p.team_slug;

delete from public.listing_reports r
using dupe_pairs p
where r.bobblehead_id = p.community_id and r.team_slug = p.team_slug;

-- A community listing should never have an override row, but
-- admin_delete_bobblehead() clears one defensively and so does this.
delete from public.bobblehead_overrides o
using dupe_pairs p
where o.bobblehead_id = p.community_id and o.team_slug = p.team_slug;

-- STEP 5 — delete the duplicates.
delete from public.community_bobbleheads cb
using dupe_pairs p
where cb.id = p.community_id and cb.team_slug = p.team_slug;

-- STEP 6 — receipt. Both counts must be 0.
select
  (select count(*) from dupe_pairs p
     join public.community_bobbleheads cb
       on cb.id = p.community_id and cb.team_slug = p.team_slug) as dupes_remaining,
  (select count(*) from dupe_pairs p
     join public.user_collections c
       on c.bobblehead_id = p.community_id and c.team_slug = p.team_slug) as stray_marks;

commit;

-- ---------------------------------------------------------------------------
-- After committing
-- ---------------------------------------------------------------------------
-- community_bobbleheads has an after-delete revalidate trigger
-- (supabase/revalidate_trigger.sql), so the twelve team pages re-render on
-- their own. Spot-check /teams/rockies for a single Todd Helton card and
-- /teams/rays for one Taj Bradley.
--
-- Storage is NOT touched: the twelve objects in the bobblehead-approved bucket
-- stay put, which is what step 1 relies on — the gallery rows now point at
-- them. If you drop step 1, those objects become orphans worth sweeping.
--
-- Still open, not covered here: astros 'biggio-bagwell-hampton-2017' vs the
-- community 'Jeff Bagwell/Craig Biggio/Mike Hampton' on the same date. Same
-- bobblehead, reworded title, so it needs a human call rather than an id match.
