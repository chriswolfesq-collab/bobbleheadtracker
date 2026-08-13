-- Referral activity over time, for /admin/stats.
--
-- Run after referrals.sql. Idempotent — safe to re-run.
--
-- Its own function rather than more keys on admin_dashboard_stats(): that one
-- is long, and rewriting it wholesale to append a few fields is a good way to
-- clobber someone else's edit to an unrelated part of it. One extra RPC on a
-- page that already makes several is not worth the risk.
--
-- On "qualified": whether a referral counts as a raffle entry is judged against
-- the account's state *now*, not when it signed up — the bar is a confirmed
-- email plus referral_qualifying_owned() bobbleheads, and someone can clear it
-- weeks after joining. So a window's qualified figure means "referrals that
-- arrived in this window and qualify today", which will drift upward for past
-- windows as those collectors fill in their shelves. That is the number the
-- drawing cares about; a frozen-at-signup count would be useless for it.
create or replace function public.admin_referral_stats()
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
      r.created_at,
      r.referrer_user_id,
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
  windows as (
    select *
    from (values
      (7, 'Last 7 days'),
      (30, 'Last 30 days'),
      (60, 'Last 60 days'),
      (90, 'Last 90 days'),
      (180, 'Last 180 days'),
      (365, 'Last year')
    ) as w(days, label)
  )
  select jsonb_build_object(
    'windows', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'days', w.days,
          'label', w.label,
          'joined', (
            select count(*) from scored s
            where s.created_at >= now() - make_interval(days => w.days)
          ),
          'qualified', (
            select count(*) from scored s
            where s.created_at >= now() - make_interval(days => w.days) and s.qualifies
          )
        ) order by w.days
      ), '[]'::jsonb)
      from windows w
    ),
    'joined_total', (select count(*) from scored),
    'qualified_total', (select count(*) from scored where qualifies),
    -- How many people the programme actually has working for it, as opposed to
    -- how many have a link. The gap between these two is the interesting one.
    'referrers_active', (select count(distinct referrer_user_id) from scored),
    'codes_minted', (select count(*) from public.profiles where referral_code is not null)
  ) into v_result;

  return v_result;
end;
$$;
