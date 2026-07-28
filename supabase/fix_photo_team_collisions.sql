-- Main photos were keyed by bobblehead_id alone, but curated ids repeat across
-- teams ("spider-man-2019" belongs to the Giants, Mets, Phillies, Pirates, AND
-- White Sox — 36 ids collide like this). Three symptoms, all reported by the
-- Giants rep on 2026-07-27:
--
--   1. A rep's photo upload for a colliding id was diverted into the gallery,
--      because approve_submission() saw ANOTHER team's approved_photos row and
--      concluded "this bobblehead already has a photo". The detail page shows
--      the gallery, so the photo appears there — but the team page card, which
--      reads approved_photos by (team_slug, bobblehead_id), stays a placeholder.
--   2. Editing such a listing with a replacement photo errored: the client
--      upsert targeted the single-column primary key, tried to UPDATE the other
--      team's row, and RLS (can_edit_team) filtered it to zero rows.
--   3. An ADMIN editing one team's listing silently hijacked the other team's
--      row — the upsert rewrote team_slug, stealing that team's main photo
--      (this happened to the Angels' Vlad Guerrero HOF photo on 2026-07-26).
--
-- Fix: key approved_photos by (team_slug, bobblehead_id), scope the checks in
-- approve_submission() to the submission's team, and repair the stranded rows.
-- Idempotent — safe to run more than once. Paste into the Supabase SQL editor.
-- Run this BEFORE deploying the matching code change (lib/adminEdit.ts now
-- upserts with onConflict: "team_slug,bobblehead_id", which needs this key).

-- 1. Composite primary key.

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.approved_photos'::regclass
      and contype = 'p'
      and array_length(conkey, 1) = 1
  ) then
    alter table public.approved_photos drop constraint approved_photos_pkey;
    alter table public.approved_photos add primary key (team_slug, bobblehead_id);
  end if;
end $$;

-- 2. approve_submission(): the has-a-photo-already check and the upsert's
--    conflict target both gain the team scope. Otherwise identical to the
--    version in add_quantity.sql.

create or replace function public.approve_submission(
  p_submission_id uuid,
  p_image_url text,
  p_curated_has_photo boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions%rowtype;
  v_has_existing_photo boolean;
  v_new_id text;
begin
  select * into v_submission
    from public.submissions
    where id = p_submission_id and status = 'pending'
    for update;

  if not found then
    raise exception 'submission not found or already reviewed';
  end if;

  -- Authorize against the submission's own team, so a rep can approve only
  -- their team's queue while an admin can approve any.
  if not public.can_edit_team(v_submission.team_slug) then
    raise exception 'not authorized';
  end if;

  if v_submission.kind = 'photo_for_existing' then
    if v_submission.target_bobblehead_id is null then
      raise exception 'missing target_bobblehead_id for photo_for_existing submission';
    end if;

    -- Scoped to the submission's team: the same bobblehead id can exist for
    -- several teams, and another team's photo must not divert this one into
    -- the gallery.
    v_has_existing_photo := p_curated_has_photo
      or exists (
        select 1 from public.approved_photos ap
          where ap.team_slug = v_submission.team_slug
            and ap.bobblehead_id = v_submission.target_bobblehead_id
      )
      or exists (
        select 1 from public.community_bobbleheads cb
          where cb.id = v_submission.target_bobblehead_id
            and cb.team_slug = v_submission.team_slug
            and cb.image_url is not null
      );

    if v_has_existing_photo then
      insert into public.bobblehead_gallery_photos (bobblehead_id, team_slug, image_url, approved_by)
      values (v_submission.target_bobblehead_id, v_submission.team_slug, p_image_url, auth.uid());
    else
      insert into public.approved_photos (bobblehead_id, team_slug, image_url, approved_by, updated_at)
      values (v_submission.target_bobblehead_id, v_submission.team_slug, p_image_url, auth.uid(), now())
      on conflict (team_slug, bobblehead_id) do update
        set image_url = excluded.image_url,
            approved_by = excluded.approved_by,
            updated_at = now();
    end if;

  elsif v_submission.kind = 'new_bobblehead' then
    v_new_id := 'community-' || v_submission.team_slug || '-' ||
      regexp_replace(lower(coalesce(v_submission.title, 'bobblehead')), '[^a-z0-9]+', '-', 'g') ||
      '-' || substr(v_submission.id::text, 1, 8);

    insert into public.community_bobbleheads (id, team_slug, title, nickname, quantity, year, date, image_url, approved_by, created_at)
    values (
      v_new_id,
      v_submission.team_slug,
      coalesce(v_submission.title, 'Untitled'),
      v_submission.nickname,
      v_submission.quantity,
      coalesce(v_submission.year, 'Unknown'),
      coalesce(v_submission.date, 'N/A'),
      p_image_url,
      auth.uid(),
      now()
    );
  else
    raise exception 'unknown submission kind %', v_submission.kind;
  end if;

  update public.submissions
    set status = 'approved', reviewed_at = now()
    where id = p_submission_id;
end;
$$;

-- 3. Repair the two listings whose main photo is stranded in the gallery
--    (verified against production on 2026-07-27): the Giants' Spider-Man and
--    the Angels' Vlad Guerrero Hall of Fame. Promote each listing's earliest
--    gallery photo to the main slot, then drop that gallery row so the photo
--    isn't listed twice. The Giants' Hello Kitty gallery photos are left
--    alone: that listing has a curated seed photo as its main image, and the
--    rep can promote his preferred shot from the gallery UI once this fix and
--    the code deploy are live.

with stranded as (
  select distinct on (g.team_slug, g.bobblehead_id)
    g.team_slug, g.bobblehead_id, g.image_url, g.approved_by
  from public.bobblehead_gallery_photos g
  where (g.team_slug, g.bobblehead_id) in (
    ('giants', 'spider-man-2019'),
    ('angels', 'vladimir-guerrero-hall-of-fame-2018')
  )
  order by g.team_slug, g.bobblehead_id, g.created_at asc
)
insert into public.approved_photos (bobblehead_id, team_slug, image_url, approved_by, updated_at)
select bobblehead_id, team_slug, image_url, approved_by, now()
from stranded
on conflict (team_slug, bobblehead_id) do nothing;

delete from public.bobblehead_gallery_photos g
using public.approved_photos ap
where ap.team_slug = g.team_slug
  and ap.bobblehead_id = g.bobblehead_id
  and ap.image_url = g.image_url
  and (g.team_slug, g.bobblehead_id) in (
    ('giants', 'spider-man-2019'),
    ('angels', 'vladimir-guerrero-hall-of-fame-2018')
  );
