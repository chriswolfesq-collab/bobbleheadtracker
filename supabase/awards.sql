-- Awards: the data the badge shelf needs that the schema didn't already have.
--
-- Everything else on the awards shelf is derived from what a member owns, so it
-- needed no storage at all. Two things aren't:
--
--   * Founding-member awards ("first 100 users") need signup ORDER, and nothing
--     recorded it. profiles.created_at can't stand in: the profiles table was
--     backfilled from auth.users long after those accounts existed, so early
--     members all share one backfill timestamp. auth.users.created_at is the
--     only true record of when someone joined.
--
--   * The team-rep award needs to be visible on a public shelf, and team_reps
--     is default-deny RLS keyed by email — unreachable by anon and unjoinable
--     from the client.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Member numbers
-- ---------------------------------------------------------------------------
-- A permanent 1-based signup rank. Assigned once and never reissued, so it is
-- also directly displayable ("Member #83") — which is half the reason to store
-- it rather than recount older accounts on every profile load.
alter table public.profiles
  add column if not exists member_number integer;

-- Unique but deliberately NOT not-null: assignment happens in a trigger, and a
-- constraint that can fail on insert would turn a numbering hiccup into a
-- failed signup. A member with a null number simply has no founding award.
create unique index if not exists profiles_member_number_key
  on public.profiles (member_number);

create sequence if not exists public.profiles_member_number_seq;

-- Backfill in true signup order. `id` breaks ties so the numbering is stable
-- across re-runs rather than shuffling accounts created in the same instant.
-- Only touches rows that don't have a number yet, so re-running never renumbers
-- anyone — a member's number is theirs permanently.
with ranked as (
  select
    u.id,
    row_number() over (order by u.created_at, u.id) as n
  from auth.users u
)
update public.profiles p
   set member_number = r.n
  from ranked r
 where p.id = r.id
   and p.member_number is null;

-- Park the sequence just above every number handed out so far. is_called=false
-- so the next nextval() returns this value rather than one past it, which is
-- what makes an empty table start at 1 instead of skipping it.
select setval(
  'public.profiles_member_number_seq',
  coalesce((select max(member_number) from public.profiles), 0) + 1,
  false
);

-- Mirrors auth.users.raw_user_meta_data into profiles.display_name, and now
-- also stamps a member number on first sight of an account.
--
-- This fires on every display-name change too, which is why the insert is
-- guarded by an existence check rather than left as a bare
-- `insert ... on conflict do update`: nextval() is evaluated even when the
-- insert conflicts, so the plain form would burn a number every time anyone
-- renamed themselves. New members would then be numbered far beyond the real
-- signup count, and "first 1,000 users" would stop meaning a thousand people.
--
-- The remaining race — two brand-new accounts inserting at once — is handled by
-- `on conflict do nothing` and costs at most one skipped number, which is why a
-- sequence is used here instead of max()+1 (that would fail the second insert
-- on the unique index rather than skip).
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = new.id) then
    insert into public.profiles (id, display_name, member_number)
    values (
      new.id,
      public.display_name_of(new.raw_user_meta_data),
      nextval('public.profiles_member_number_seq')
    )
    on conflict (id) do nothing;
  end if;

  update public.profiles
     set display_name = public.display_name_of(new.raw_user_meta_data),
         updated_at = now()
   where id = new.id;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public shelf: member number and rep teams
-- ---------------------------------------------------------------------------
-- Two more columns on the existing public read surface so a visitor sees the
-- same awards the owner does. Both are already public facts by intent — they
-- exist to be displayed on a shelf someone chose to share.
--
-- Dropped and recreated rather than replaced: Postgres refuses to change a
-- function's return type in place.
drop function if exists public.get_public_shelf(text);

create function public.get_public_shelf(p_slug text)
returns table (
  display_name text,
  counts jsonb,
  member_number integer,
  rep_teams text[]
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
    )
  from public.profiles p
  where p.slug = p_slug and p.is_public;
$$;

grant execute on function public.get_public_shelf(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Own awards
-- ---------------------------------------------------------------------------
-- The signed-in member's own rep teams. my_editable_teams() already returns
-- this, but it is scoped to the admin console's meaning of "editable" and
-- returns nothing for a full admin (who edits every team without being a rep
-- of any). The awards shelf wants the literal question — which teams do I rep —
-- so it gets its own function rather than reinterpreting that one.
create or replace function public.my_rep_teams()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select array_agg(r.team_slug order by r.team_slug)
      from public.team_reps r
      where lower(r.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    ),
    '{}'::text[]
  );
$$;

revoke all on function public.my_rep_teams() from public, anon;
grant execute on function public.my_rep_teams() to authenticated;
