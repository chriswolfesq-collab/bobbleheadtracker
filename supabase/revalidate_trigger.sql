-- Tells the site to refresh the curated bobblehead detail pages whenever an
-- admin edit lands, so the prerendered HTML reflects the new title/date/photo
-- without a redeploy. Uses pg_net to POST the Next.js revalidate route, the
-- same mechanism as supabase/webhook_trigger.sql.
--
-- Replace <REVALIDATE_SECRET> below with the actual value before running -- it
-- must match the REVALIDATE_SECRET environment variable set in the Vercel
-- project. Do not commit the filled-in version of this file.
--
-- Fires on insert/update/delete of the two tables that back a curated
-- listing's server-rendered data: bobblehead_overrides (title/date/deleted)
-- and approved_photos (main photo). The route revalidates a single shared
-- cache tag, so the body doesn't need to say which listing changed.

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
