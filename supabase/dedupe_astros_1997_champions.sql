-- ---------------------------------------------------------------------------
-- Remove the 13th duplicate: Astros 1997 NL Central Champions, Aug 19 2017
-- ---------------------------------------------------------------------------
-- Follow-up to supabase/dedupe_community_listings.sql, which cleared twelve
-- community listings whose title and date matched a curated one exactly. This
-- is the thirteenth from that same 2026-07-15 approval batch. It was left out
-- of that script because the titles are worded differently --
--
--   curated    biggio-bagwell-hampton-2017   'Biggio, Bagwell, Hampton'
--   community  ...-8396523b                  'Jeff Bagwell/Craig Biggio/Mike Hampton'
--
-- -- so no id or string match could catch it, and it needed a human look.
--
-- Confirmed the same bobblehead by comparing the two photos: identical
-- three-figure sculpt (Hampton #10 reaching in, Biggio hoisted, Bagwell), the
-- same Methodist sponsor plaque, and the same green base reading "HOUSTON
-- ASTROS 1997 NL CENTRAL DIVISION CHAMPIONS". The community shot also shows
-- the box: "1997 NL Central Division Champions Bobblehead - Bagwell, Biggio,
-- Hampton", Legends Weekend. Same date, same year, one giveaway.
--
-- The curated row is the keeper: it carries the quantity (10,000), the seed
-- photo, and the stable id. Structure, rationale and cascade are identical to
-- dedupe_community_listings.sql -- see that file's header for why this cannot
-- call admin_delete_bobblehead() and why marks are moved rather than dropped.
--
-- Run as two blocks: BLOCK A first, read the output, then BLOCK B.

-- ===========================================================================
-- BLOCK A -- pre-flight. Run alone. Changes nothing.
-- ===========================================================================
-- Expect exactly 1 row. If owned/favorited/wanted are all 0, steps 2 and 3 of
-- BLOCK B are no-ops; if any are non-zero they move those marks onto the
-- curated twin. user_collections is owner-select-only under RLS, so this
-- query -- run as the dashboard superuser -- is the only trustworthy read.

select
  cb.id           as community_id,
  cb.team_slug,
  cb.title,
  cb.date,
  cb.image_url,
  (select count(*) from public.user_collections c
     where c.bobblehead_id = cb.id and c.team_slug = 'astros')  as owned,
  (select count(*) from public.user_favorites f
     where f.bobblehead_id = cb.id and f.team_slug = 'astros')  as favorited,
  (select count(*) from public.user_wants w
     where w.bobblehead_id = cb.id and w.team_slug = 'astros')  as wanted,
  (select count(*) from public.submissions s
     where s.target_bobblehead_id = cb.id
       and s.team_slug = 'astros' and s.status = 'pending')     as pending_subs
from public.community_bobbleheads cb
where cb.id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b'
  and cb.team_slug = 'astros';

-- ===========================================================================
-- BLOCK B -- the deletion. Run as one block, after BLOCK A looks right.
-- ===========================================================================
-- The editor runs the whole block and commits at the end, so the final check
-- is a receipt, not a gate. To gate on it: delete the closing `commit;`, run
-- the block, read the result, then send `commit;` or `rollback;` separately.

begin;

-- Abort rather than half-apply if the row is already gone.
do $$
declare
  v_found int;
begin
  select count(*) into v_found
  from public.community_bobbleheads
  where id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b'
    and team_slug = 'astros';

  if v_found <> 1 then
    raise exception 'expected 1 duplicate row, found % -- re-run BLOCK A', v_found;
  end if;
end;
$$;

-- STEP 1 -- keep the fan photo. The community shot shows the bobblehead in its
-- original box, which the curated seed photo does not, so it is worth more
-- than the row it hangs off. Re-file onto the curated twin's gallery before
-- deleting, so the storage object is not orphaned. Additive: the curated seed
-- photo is untouched.
insert into public.bobblehead_gallery_photos (bobblehead_id, team_slug, image_url, approved_by)
select 'biggio-bagwell-hampton-2017', 'astros', cb.image_url, cb.approved_by
from public.community_bobbleheads cb
where cb.id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b'
  and cb.team_slug = 'astros'
  and cb.image_url is not null
  and not exists (
    select 1 from public.bobblehead_gallery_photos g
    where g.bobblehead_id = 'biggio-bagwell-hampton-2017'
      and g.team_slug = 'astros'
      and g.image_url = cb.image_url
  );

-- STEP 2 -- move collection marks onto the curated twin rather than dropping
-- them: an identical listing survives, so anyone who marked this as owned
-- still owns the bobblehead.
insert into public.user_collections (user_id, bobblehead_id, team_slug, owned, condition, acquired_on, price_paid, notes, updated_at)
select c.user_id, 'biggio-bagwell-hampton-2017', 'astros', c.owned, c.condition, c.acquired_on, c.price_paid, c.notes, c.updated_at
from public.user_collections c
where c.bobblehead_id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b'
  and c.team_slug = 'astros'
on conflict (user_id, team_slug, bobblehead_id) do nothing;

insert into public.user_favorites (user_id, bobblehead_id, team_slug, favorited, updated_at)
select f.user_id, 'biggio-bagwell-hampton-2017', 'astros', f.favorited, f.updated_at
from public.user_favorites f
where f.bobblehead_id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b'
  and f.team_slug = 'astros'
on conflict (user_id, team_slug, bobblehead_id) do nothing;

insert into public.user_wants (user_id, bobblehead_id, team_slug, wanted, updated_at)
select w.user_id, 'biggio-bagwell-hampton-2017', 'astros', w.wanted, w.updated_at
from public.user_wants w
where w.bobblehead_id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b'
  and w.team_slug = 'astros'
on conflict (user_id, team_slug, bobblehead_id) do nothing;

-- STEP 3 -- repoint pending photo submissions at the survivor rather than
-- rejecting them; the bobblehead they photographed still exists.
update public.submissions
set target_bobblehead_id = 'biggio-bagwell-hampton-2017'
where target_bobblehead_id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b'
  and team_slug = 'astros'
  and status = 'pending';

-- STEP 4 -- clear everything still hanging off the doomed row.
delete from public.user_collections
where bobblehead_id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b' and team_slug = 'astros';

delete from public.user_favorites
where bobblehead_id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b' and team_slug = 'astros';

delete from public.user_wants
where bobblehead_id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b' and team_slug = 'astros';

delete from public.approved_photos
where bobblehead_id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b' and team_slug = 'astros';

delete from public.bobblehead_gallery_photos
where bobblehead_id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b' and team_slug = 'astros';

delete from public.listing_reports
where bobblehead_id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b' and team_slug = 'astros';

delete from public.bobblehead_overrides
where bobblehead_id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b' and team_slug = 'astros';

-- STEP 5 -- delete the duplicate.
delete from public.community_bobbleheads
where id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b'
  and team_slug = 'astros';

-- STEP 6 -- receipt. Both counts must be 0.
select
  (select count(*) from public.community_bobbleheads
     where id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b') as dupes_remaining,
  (select count(*) from public.user_collections
     where bobblehead_id = 'community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b') as stray_marks;

commit;

-- ---------------------------------------------------------------------------
-- After committing
-- ---------------------------------------------------------------------------
-- The after-delete revalidate trigger re-renders /teams/astros on its own. The
-- pair sits on page 4 of the team page (24 per page, newest first, Aug 2017),
-- or search "Bagwell" from the site header. The total should drop 204 -> 203.
--
-- Optional, not done here: the box art titles this "1997 NL Central Division
-- Champions" and the curated title is a bare player list. A nickname override
-- in bobblehead_overrides would surface that on the card. Left alone since it
-- is an editorial call, not part of removing the duplicate.
