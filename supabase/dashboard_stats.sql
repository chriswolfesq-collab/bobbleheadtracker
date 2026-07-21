-- Admin dashboard metrics.
-- Run this in the Supabase SQL editor after schema.sql (and after
-- dead_images.sql / scraped_giveaways.sql, whose tables it reads). Safe to
-- re-run.
--
-- One SECURITY DEFINER function returns the whole dashboard as a single jsonb
-- object, so the stats page (app/admin/stats/page.tsx) needs just one round
-- trip. Same authorization model as admin_list_users() in schema.sql: it runs
-- with the owner's privileges so it can read auth.users, but re-checks
-- is_admin() first, so a non-admin caller gets 'not authorized' no matter what
-- the client claims.
--
-- Everything here is read-only aggregate counts — no per-user rows leave the
-- function — so it is stable and cheap enough to compute on each page load
-- rather than being cached.

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_7d timestamptz := now() - interval '7 days';
  v_30d timestamptz := now() - interval '30 days';
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    -- Accounts
    'users_total', (select count(*) from auth.users),
    'users_signed_in', (select count(*) from auth.users where last_sign_in_at is not null),
    'users_new_7d', (select count(*) from auth.users where created_at >= v_7d),
    'users_new_30d', (select count(*) from auth.users where created_at >= v_30d),
    'public_shelves', (select count(*) from public.profiles where is_public),

    -- Collection totals
    'owned_total', (select count(*) from public.user_collections where owned),
    'wanted_total', (select count(*) from public.user_wants where wanted),
    'favorite_total', (select count(*) from public.user_favorites where favorited),
    'community_total', (select count(*) from public.community_bobbleheads),
    'gallery_total', (select count(*) from public.bobblehead_gallery_photos),

    -- Open queues (mirrors the landing-page badges, gathered here in one place)
    'pending_submissions', (select count(*) from public.submissions where status = 'pending'),
    'pending_reports', (select count(*) from public.listing_reports where status = 'pending'),
    'open_dead_images', (select count(*) from public.dead_images where status = 'open'),
    'pending_scraped', (select count(*) from public.scraped_giveaways where status = 'pending'),

    -- Throughput (last 7 days)
    'submissions_7d', (select count(*) from public.submissions where created_at >= v_7d),
    'submissions_approved_7d',
      (select count(*) from public.submissions where status = 'approved' and reviewed_at >= v_7d),
    'submissions_rejected_7d',
      (select count(*) from public.submissions where status = 'rejected' and reviewed_at >= v_7d),
    'reports_7d', (select count(*) from public.listing_reports where created_at >= v_7d),

    -- Top 5 teams by owned bobbleheads. Slug only; the page maps it to a team
    -- name via lib/teams.ts so this stays independent of that static data.
    'top_teams', coalesce((
      select jsonb_agg(t)
      from (
        select uc.team_slug as slug, count(*)::int as count
        from public.user_collections uc
        where uc.owned
        group by uc.team_slug
        order by count(*) desc, uc.team_slug
        limit 5
      ) t
    ), '[]'::jsonb),

    -- Community listings per team, with how many of them carry at least one
    -- photo (the listing's own image_url, an approved main photo, or a gallery
    -- photo matched by id). Every team with listings is returned; the page maps
    -- slug -> name via lib/teams.ts.
    'listings_by_team', coalesce((
      select jsonb_agg(t)
      from (
        select
          cb.team_slug as slug,
          count(*)::int as total,
          count(*) filter (
            where cb.image_url is not null
              or exists (
                select 1 from public.approved_photos ap where ap.bobblehead_id = cb.id
              )
              or exists (
                select 1 from public.bobblehead_gallery_photos gp where gp.bobblehead_id = cb.id
              )
          )::int as with_photos
        from public.community_bobbleheads cb
        group by cb.team_slug
        order by count(*) desc, cb.team_slug
      ) t
    ), '[]'::jsonb),

    -- Top 5 listings by number of still-pending reports, so the most-complained
    -- -about listings float to the top of the queue's attention.
    'most_reported', coalesce((
      select jsonb_agg(r)
      from (
        select lr.team_slug, lr.bobblehead_id, min(lr.title) as title, count(*)::int as count
        from public.listing_reports lr
        where lr.status = 'pending'
        group by lr.team_slug, lr.bobblehead_id
        order by count(*) desc, min(lr.title)
        limit 5
      ) r
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
