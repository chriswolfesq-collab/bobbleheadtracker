-- Awards for the three things a collection alone can't show: what a member has
-- contributed, who they've brought in, and whether they keep showing up.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- When something was added
-- ---------------------------------------------------------------------------
-- Streak awards need to know WHEN each bobblehead went on the shelf, and
-- nothing recorded that. updated_at can't stand in: every ownership toggle
-- overwrites it (see lib/userCollections.ts), so un-marking and re-marking an
-- item rewrites its history, and a member could manufacture a streak by
-- clicking the same checkbox once a month.
--
-- added_at is written by the column default on insert and by nothing else. The
-- upserts that maintain this table list their columns explicitly and never
-- include it, so ON CONFLICT DO UPDATE leaves it alone — the first time an item
-- is added is the time that sticks, permanently.
alter table public.user_collections
  add column if not exists added_at timestamptz;

-- Backfilled from updated_at, which is the best record that exists: for rows
-- never toggled since being added it IS the added time, and for the rest it's
-- the closest thing. Only fills nulls, so re-running never rewrites a real one.
update public.user_collections
   set added_at = updated_at
 where added_at is null;

alter table public.user_collections
  alter column added_at set default now();

-- Deliberately left nullable rather than backfilled-and-NOT-NULL: a row with no
-- added_at simply contributes no month to a streak, which is a far better
-- failure than a constraint that can reject someone marking a bobblehead owned.

-- ---------------------------------------------------------------------------
-- The three counts
-- ---------------------------------------------------------------------------

-- Approved submissions, of either kind. Pending and rejected deliberately don't
-- count: awarding on submission alone would pay out for spam, and the award is
-- meant to mark a contribution that actually stuck.
create or replace function public.approved_submission_count(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.submissions s
  where s.submitted_by = p_user and s.status = 'approved';
$$;

-- Referrals that clear the same bar the raffle uses: the friend confirmed their
-- email and has marked at least referral_qualifying_owned() bobbleheads owned.
--
-- The rule is spelled out inline here and in my_referral() rather than shared,
-- matching what referral_leaderboard already does. What matters — the threshold
-- itself — lives in referral_qualifying_owned() and is shared by all three, so
-- tuning the anti-fraud number stays a one-line change.
create or replace function public.qualifying_referral_count(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.referrals r
  join auth.users u on u.id = r.referred_user_id
  where r.referrer_user_id = p_user
    and u.email_confirmed_at is not null
    and (
      select count(*)
      from public.user_collections c
      where c.user_id = r.referred_user_id and c.owned
    ) >= public.referral_qualifying_owned();
$$;

-- The distinct months a member added something, as 'YYYY-MM'.
--
-- Returns the months rather than a streak number on purpose: turning them into
-- a streak is calendar logic with edge cases (an unfinished current month must
-- not break a run), and it belongs somewhere it can be unit-tested. Both the
-- profile and the public shelf run the same TypeScript over this — see
-- computeCollectingStreak in lib/awards.ts.
create or replace function public.collecting_months(p_user uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(distinct to_char(date_trunc('month', c.added_at), 'YYYY-MM')),
    '{}'::text[]
  )
  from public.user_collections c
  where c.user_id = p_user and c.owned and c.added_at is not null;
$$;

revoke all on function public.approved_submission_count(uuid) from public, anon, authenticated;
revoke all on function public.qualifying_referral_count(uuid) from public, anon, authenticated;
revoke all on function public.collecting_months(uuid) from public, anon, authenticated;

-- Nobody calls these directly — they take a user id, so granting them would let
-- any caller read these counts for any account. They exist only to be called
-- from the two definer functions below, which each fix the user themselves.

-- ---------------------------------------------------------------------------
-- The caller's own numbers
-- ---------------------------------------------------------------------------
create or replace function public.my_award_activity()
returns table (
  approved_submissions integer,
  qualifying_referrals integer,
  months text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.approved_submission_count(auth.uid()),
    public.qualifying_referral_count(auth.uid()),
    public.collecting_months(auth.uid())
  where auth.uid() is not null;
$$;

revoke all on function public.my_award_activity() from public, anon;
grant execute on function public.my_award_activity() to authenticated;

-- ---------------------------------------------------------------------------
-- Public shelf: the same three, for a shelf its owner chose to share
-- ---------------------------------------------------------------------------
drop function if exists public.get_public_shelf(text);

create function public.get_public_shelf(p_slug text)
returns table (
  display_name text,
  counts jsonb,
  member_number integer,
  rep_teams text[],
  approved_submissions integer,
  qualifying_referrals integer,
  collecting_months text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.display_name,
    coalesce(
      (
        select jsonb_object_agg(t.team_slug, t.cnt)
        from (
          select c.team_slug, count(*)::int as cnt
          from public.user_collections c
          where c.user_id = p.id
            and c.owned
            -- Deleting a listing leaves the collection rows pointing at it, and
            -- counting them put bobbleheads on a shelf that 404 when opened.
            -- See supabase/public_shelf_excludes_deleted.sql.
            and not exists (
              select 1
              from public.bobblehead_overrides o
              where o.team_slug = c.team_slug
                and o.bobblehead_id = c.bobblehead_id
                and o.deleted
            )
          group by c.team_slug
        ) t
      ),
      '{}'::jsonb
    ),
    p.member_number,
    -- Reps are keyed by email, which lives in auth.users and is reachable only
    -- from a definer function like this one. The email itself never leaves —
    -- only the team slugs the account reps, which are what the award shows.
    coalesce(
      (
        select array_agg(r.team_slug order by r.team_slug)
        from public.team_reps r
        join auth.users u on u.id = p.id
        where lower(r.email) = lower(u.email)
      ),
      '{}'::text[]
    ),
    public.approved_submission_count(p.id),
    -- A count, never who. Handing out the identities of everyone who joined
    -- through someone is a privacy leak for *them*, and they never agreed to
    -- appear on a shelf they don't own.
    public.qualifying_referral_count(p.id),
    public.collecting_months(p.id)
  from public.profiles p
  where p.slug = p_slug and p.is_public;
$$;

grant execute on function public.get_public_shelf(text) to anon, authenticated;
