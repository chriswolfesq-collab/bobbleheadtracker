-- Per-member referral counts, broken out by time window. The list a drawing is
-- built from: who brought in how many, over the period the drawing covers.
--
-- Run after referrals.sql. Idempotent — safe to re-run.
--
-- Replaces the flat admin_referral_leaderboard() from referrals.sql, which
-- returned lifetime totals only. Nothing consumed it yet, so the shape changes
-- outright rather than gaining a parallel function.
--
-- Returns jsonb rather than a table so the six windows can be columns without
-- a thirteen-argument RETURNS TABLE, and so callers get one object per member
-- instead of having to pivot rows themselves.
--
-- Two numbers per window, and they are not interchangeable:
--   joined    — friends who signed up through that member's link
--   qualified — of those, the ones clearing the raffle bar (confirmed email
--               plus referral_qualifying_owned() bobbleheads)
--
-- Draw on `qualified`. `joined` is there to show the gap, which is where a
-- member is sending links to people who sign up and then never fill a shelf.
--
-- Qualification is judged as of now, not frozen at signup — a collector can
-- clear the bar weeks after joining, so a past window's qualified figure rises
-- as shelves fill in. See supabase/referral_stats.sql for why that is the
-- behaviour a drawing wants.
drop function if exists public.admin_referral_leaderboard();

create or replace function public.admin_referral_leaderboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with scored as (
    select
      r.referrer_user_id,
      r.created_at,
      (
        u.email_confirmed_at is not null
        and (
          select count(*)
          from public.user_collections c
          where c.user_id = r.referred_user_id and c.owned
        ) >= public.referral_qualifying_owned()
      ) as qualifies
    from public.referrals r
    join auth.users u on u.id = r.referred_user_id
  ),
  -- Every member holding a link, not just those who have landed one. A rep
  -- sitting on zero is exactly what you want to see when deciding whether the
  -- programme is working, and they vanish from an inner join.
  members as (
    select p.id, p.display_name, p.referral_code
    from public.profiles p
    where p.referral_code is not null
  ),
  counted as (
    select
      m.id,
      m.display_name,
      m.referral_code,
      count(s.referrer_user_id) as joined_total,
      count(s.referrer_user_id) filter (where s.qualifies) as qualified_total,
      count(s.referrer_user_id) filter (where s.created_at >= now() - interval '7 days') as joined_7,
      count(s.referrer_user_id) filter (where s.created_at >= now() - interval '7 days' and s.qualifies) as qualified_7,
      count(s.referrer_user_id) filter (where s.created_at >= now() - interval '30 days') as joined_30,
      count(s.referrer_user_id) filter (where s.created_at >= now() - interval '30 days' and s.qualifies) as qualified_30,
      count(s.referrer_user_id) filter (where s.created_at >= now() - interval '60 days') as joined_60,
      count(s.referrer_user_id) filter (where s.created_at >= now() - interval '60 days' and s.qualifies) as qualified_60,
      count(s.referrer_user_id) filter (where s.created_at >= now() - interval '90 days') as joined_90,
      count(s.referrer_user_id) filter (where s.created_at >= now() - interval '90 days' and s.qualifies) as qualified_90,
      count(s.referrer_user_id) filter (where s.created_at >= now() - interval '180 days') as joined_180,
      count(s.referrer_user_id) filter (where s.created_at >= now() - interval '180 days' and s.qualifies) as qualified_180,
      count(s.referrer_user_id) filter (where s.created_at >= now() - interval '365 days') as joined_365,
      count(s.referrer_user_id) filter (where s.created_at >= now() - interval '365 days' and s.qualifies) as qualified_365
    from members m
    left join scored s on s.referrer_user_id = m.id
    group by m.id, m.display_name, m.referral_code
  )
  select coalesce(jsonb_agg(to_jsonb(counted) order by qualified_total desc, joined_total desc, display_name), '[]'::jsonb)
  into v_result
  from counted;

  return v_result;
end;
$$;
