-- The weekly digest: "3 new bobbleheads added for teams you collect."
-- Run after email_preferences.sql; safe to re-run.
--
-- The only automated email that goes to ordinary collectors on a schedule
-- rather than in response to something they did, so two things matter more here
-- than elsewhere: it is scoped tightly to what the recipient already cares
-- about, and a week with nothing new sends nothing at all. A digest that
-- reliably arrives empty is a digest people filter.
--
-- Same shape as the rep digest: the aggregation happens in SQL and hands a
-- finished payload to a dumb mailer, so the edge function needs no database
-- access and no service-role key.

-- ---------------------------------------------------------------------------
-- The preference
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists email_weekly_digest boolean not null default true;

-- wants_email and set_email_preference are recreated in full rather than
-- patched, because both enumerate the known kinds and an unlisted kind fails
-- closed by design — adding the column without adding it here would leave a
-- preference nobody can turn off and a digest that never sends.
create or replace function public.wants_email(p_user_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user_id is null then false
    else coalesce(
      (
        select p.email_enabled
           and case p_kind
                 when 'all' then true
                 when 'wanted_alerts' then p.email_wishlist_alerts
                 when 'submission_updates' then p.email_submission_updates
                 when 'rep_digest' then p.email_rep_digest
                 when 'weekly_digest' then p.email_weekly_digest
                 -- An unknown kind is a bug in the caller. Fail closed rather
                 -- than mailing on a preference nobody can turn off.
                 else false
               end
        from public.profiles p
        where p.id = p_user_id
      ),
      -- No profile row: honor the master default (on) for known kinds only.
      p_kind in ('all', 'wanted_alerts', 'submission_updates', 'rep_digest', 'weekly_digest')
    )
  end;
$$;

revoke all on function public.wants_email(uuid, text) from public, anon;
grant execute on function public.wants_email(uuid, text) to authenticated;

create or replace function public.set_email_preference(p_kind text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean := coalesce(p_enabled, true);
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_kind is null or p_kind not in
    ('all', 'wanted_alerts', 'submission_updates', 'rep_digest', 'weekly_digest') then
    raise exception 'unknown email preference: %', p_kind;
  end if;

  insert into public.profiles (id) values (auth.uid())
  on conflict (id) do nothing;

  update public.profiles set
    email_enabled =
      case when p_kind = 'all' then v_enabled else email_enabled end,
    email_wishlist_alerts =
      case when p_kind = 'wanted_alerts' then v_enabled else email_wishlist_alerts end,
    email_submission_updates =
      case when p_kind = 'submission_updates' then v_enabled else email_submission_updates end,
    email_rep_digest =
      case when p_kind = 'rep_digest' then v_enabled else email_rep_digest end,
    email_weekly_digest =
      case when p_kind = 'weekly_digest' then v_enabled else email_weekly_digest end,
    updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.set_email_preference(text, boolean) from public, anon;
grant execute on function public.set_email_preference(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- The digest
-- ---------------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;

-- Replace <WEBHOOK_SECRET> below with the real value before running -- it must
-- match `supabase secrets set WEBHOOK_SECRET=...` (shared with the other
-- functions). Do not commit the filled-in version of this file.
create or replace function public.send_weekly_digest(p_days int default 7)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(p_days, 1));
  v_new_count int;
  v_recipients jsonb;
begin
  -- Only community additions count as "new". Curated listings arrive by a data
  -- import that can touch thousands of rows at once, and a digest that says
  -- "1,400 new bobbleheads" the week of a backfill is noise, not news.
  select count(*)
  into v_new_count
  from public.community_bobbleheads cb
  where cb.created_at >= v_since;

  -- A quiet week sends nothing. See the note at the top.
  if v_new_count = 0 then
    return 0;
  end if;

  -- One row per recipient, carrying only the additions on teams they collect.
  --
  -- "Collects" means they've marked something owned or wanted on that team.
  -- Favorites deliberately don't count: favoriting is a browsing gesture people
  -- make on teams they have no intention of collecting, and it would widen the
  -- email to teams they never asked about.
  select jsonb_agg(r)
  into v_recipients
  from (
    select
      u.email as email,
      count(*)::int as total,
      -- Cap the listed items; the count carries the rest. A week where one team
      -- adds forty listings shouldn't produce a forty-line email.
      (array_agg(cb.title order by cb.created_at desc))[1:8] as samples,
      array_agg(distinct cb.team_slug) as teams
    from auth.users u
    join lateral (
      select distinct team_slug
      from (
        select team_slug from public.user_collections where user_id = u.id and owned
        union
        select team_slug from public.user_wants where user_id = u.id and wanted
      ) t
    ) collected on true
    join public.community_bobbleheads cb
      on cb.team_slug = collected.team_slug
     and cb.created_at >= v_since
    where u.email is not null
      and public.wants_email(u.id, 'weekly_digest')
    group by u.email
  ) r;

  if v_recipients is null or jsonb_array_length(v_recipients) = 0 then
    return 0;
  end if;

  perform net.http_post(
    url := 'https://mawwzvnlihhsagatmolq.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '<WEBHOOK_SECRET>'
    ),
    body := jsonb_build_object(
      'days', greatest(p_days, 1),
      'recipients', v_recipients
    )
  );

  return jsonb_array_length(v_recipients);
end;
$$;

revoke all on function public.send_weekly_digest(int) from public, anon;
-- So an admin can fire it by hand to check the wiring without waiting a week.
grant execute on function public.send_weekly_digest(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Schedule
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;

-- Thursday 15:00 UTC — mid-morning US Eastern on a weekday, which is when a
-- "here's what's new" email is most likely to be read rather than buried under
-- a weekend's backlog. Unschedule first so re-running this file doesn't stack a
-- second job on top of the first.
select cron.unschedule('weekly-digest')
  where exists (select 1 from cron.job where jobname = 'weekly-digest');

select cron.schedule(
  'weekly-digest',
  '0 15 * * 4',
  $$select public.send_weekly_digest(7)$$
);
