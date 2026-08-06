-- Tells the site to refresh the curated bobblehead detail pages whenever an
-- admin edit lands, so the prerendered HTML reflects the new title/date/photo
-- without a redeploy. Uses pg_net to POST the Next.js revalidate route, the
-- same mechanism as supabase/webhook_trigger.sql.
--
-- Replace <REVALIDATE_SECRET> below with the actual value before running -- it
-- must match the REVALIDATE_SECRET environment variable set in the Vercel
-- project. Do not commit the filled-in version of this file.
--
-- Fires on insert/update/delete of the four tables that back a listing's
-- server-rendered data: bobblehead_overrides (title/date/deleted),
-- approved_photos (main photo), community_bobbleheads (the listings
-- themselves), and bobblehead_gallery_photos (the fallback main photo). The
-- route revalidates a single shared cache tag, so the body doesn't need to say
-- which listing changed.
--
-- Between them these cover every DB read the prerendered pages make, which is
-- what lets lib/curatedListing.ts and lib/communityServer.ts cache with
-- `revalidate: false`. A table that feeds those pages without a trigger here
-- would go stale forever, so add one alongside any new read.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_revalidate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://bobbleshelf.com/api/revalidate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-revalidate-secret', '<REVALIDATE_SECRET>'
    ),
    body := '{}'::jsonb
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists revalidate_on_override_change on public.bobblehead_overrides;
create trigger revalidate_on_override_change
  after insert or update or delete on public.bobblehead_overrides
  for each row
  execute function public.notify_revalidate();

drop trigger if exists revalidate_on_photo_change on public.approved_photos;
create trigger revalidate_on_photo_change
  after insert or update or delete on public.approved_photos
  for each row
  execute function public.notify_revalidate();

-- A community listing is the one thing here that can appear out of nowhere, so
-- leaving it out kept new ones out of the sitemap and out of the team page's
-- server-rendered count for up to an hour after they went live.
drop trigger if exists revalidate_on_community_change on public.community_bobbleheads;
create trigger revalidate_on_community_change
  after insert or update or delete on public.community_bobbleheads
  for each row
  execute function public.notify_revalidate();

-- A gallery photo is the main photo for any listing with no admin-approved one,
-- so it changes what the prerendered page shows. This used to be covered by an
-- hourly revalidate in lib/curatedListing.ts, which put every prerendered page
-- on a 1h ISR clock; the trigger gets the same freshness for the handful of
-- rows that actually change instead of re-rendering the site hourly.
drop trigger if exists revalidate_on_gallery_photo_change on public.bobblehead_gallery_photos;
create trigger revalidate_on_gallery_photo_change
  after insert or update or delete on public.bobblehead_gallery_photos
  for each row
  execute function public.notify_revalidate();
