-- One-time seed: preserve the Athletics giveaway photos that predated the
-- switch to MLB's official "Head's Up" bobblehead imagery.
--
-- data/giveaways/athletics.json now uses the official mlb.com/athletics photo
-- as each listing's default (its build-time seed imageUrl). For three 2025
-- listings that previously carried a non-MLB photo, this file re-files that
-- older photo into the browsable gallery so it isn't lost -- the MLB shot shows
-- as the main image, the original shows underneath in the gallery.
--
-- Run ONCE in the Supabase SQL editor (it runs as postgres and bypasses the
-- admin-only insert policy on bobblehead_gallery_photos). Safe to re-run: each
-- insert is guarded so the same photo is never added twice.

insert into public.bobblehead_gallery_photos (bobblehead_id, team_slug, image_url)
select v.bobblehead_id, v.team_slug, v.image_url
from (
  values
    ('lawrence-butler-2025', 'athletics', 'https://pbs.twimg.com/media/Gvf2v3fakAQwy46.jpg'),
    ('mason-miller-2025', 'athletics', 'https://bullpenbobbles.com/wp-content/uploads/Mason-Miller-Oakland-Athletics-2025.jpg'),
    ('brent-rooker-2025', 'athletics', 'https://bullpenbobbles.com/wp-content/uploads/Brent-Rooker-Oakland-Athletics-2025.jpg')
) as v (bobblehead_id, team_slug, image_url)
where not exists (
  select 1 from public.bobblehead_gallery_photos g
  where g.bobblehead_id = v.bobblehead_id
    and g.image_url = v.image_url
);
