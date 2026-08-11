-- Refer a Friend: a per-account invite code, and one row per referred signup.
--
-- Run after schema.sql. Idempotent — safe to re-run.
--
-- The point of recording this at all is the raffle: an entry is earned per
-- friend who joins, so "who referred whom" has to be a fact in the database
-- rather than an honour system. Two rules do most of the anti-fraud work:
--
--   1. referrals is keyed by the *referred* user, so an account can be
--      credited to exactly one referrer, once, ever. There is no path to
--      re-attributing it later.
--   2. A row on its own earns nothing. An entry is only counted once the
--      referred account has confirmed its email and marked some bobbleheads
--      owned — see referral_qualifying_owned() below. Spinning up throwaway
--      accounts is cheap; doing that *and* filling in a shelf for each is not.

-- ---------------------------------------------------------------------------
-- The invite code
-- ---------------------------------------------------------------------------

-- Deliberately a separate column from profiles.slug, not a reuse of it. slug is
-- the public shelf URL and stays null until the user opts into sharing — so
-- keying invites off it would mean private-shelf collectors could never earn a
-- raffle entry, and minting one early would hand out a /shelf/<slug> address
-- nobody asked to publish. referral_code is minted on demand, means nothing but
-- "this link came from that person", and grants no read access to anything.
alter table public.profiles add column if not exists referral_code text;

create unique index if not exists profiles_referral_code_key
  on public.profiles (referral_code);

-- ---------------------------------------------------------------------------
-- The attribution record
-- ---------------------------------------------------------------------------

create table if not exists public.referrals (
  -- Primary key, not just a foreign key: one referrer per account, forever.
  referred_user_id uuid primary key references auth.users (id) on delete cascade,
  referrer_user_id uuid not null references auth.users (id) on delete cascade,
  -- The code as it was used. Kept alongside the id because the code is what
  -- appeared in the shared link, and it's the only way to tell which of a
  -- person's posted links actually worked once codes can be reissued.
  referral_code text not null,
  created_at timestamptz not null default now(),
  constraint referrals_not_self check (referred_user_id <> referrer_user_id)
);

create index if not exists referrals_referrer_idx
  on public.referrals (referrer_user_id);

alter table public.referrals enable row level security;

-- Note what is NOT here: no insert, update or delete policy for authenticated,
-- and no owner select. Same posture as profiles — the client's entire surface
-- is claim_referral() and my_referral() below, both SECURITY DEFINER. Direct
-- table access would let a client write its own attribution row, which is the
-- one thing this table exists to prevent. A plain owner-select policy is also
-- more than the feature needs: the profile shows a *count*, and handing out the
-- user ids of everyone who joined through you is a privacy leak for them.
drop policy if exists "referrals: admin select" on public.referrals;
create policy "referrals: admin select"
  on public.referrals for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- The qualifying bar
-- ---------------------------------------------------------------------------

-- How many owned bobbleheads a referred account must record before the referral
-- counts as a raffle entry. Its own function so the raffle drawing, the profile
-- counter and any future admin report can never disagree about the rule — and
-- so changing the bar is a one-line migration rather than a hunt.
--
-- Three is chosen to be trivial for a real collector (it's the first thing
-- anyone does after signing up) and tedious for someone running a farm of fake
-- accounts, which is the entire job of this number.
create or replace function public.referral_qualifying_owned()
returns int
language sql
immutable
as $$
  select 3;
$$;

-- ---------------------------------------------------------------------------
-- Minting a code + reading your own numbers
-- ---------------------------------------------------------------------------

-- One call for the whole Refer a Friend panel: mints the caller's code on first
-- use and returns it with their counts.
--
-- SECURITY DEFINER because profiles has no update policy (see schema.sql: a
-- client that could write the table could squat someone else's shelf URL), and
-- because the qualified count has to read auth.users.email_confirmed_at, which
-- is unreachable from the client by design.
create or replace function public.my_referral()
returns table (code text, joined int, qualified int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_base text;
  v_candidate text;
  v_suffix int := 2;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- Defensive: sync_profile_from_auth should have made this row at signup.
  insert into public.profiles (id, display_name)
  select v_user_id, public.display_name_of(u.raw_user_meta_data)
  from auth.users u
  where u.id = v_user_id
  on conflict (id) do nothing;

  select referral_code into v_code from public.profiles where id = v_user_id;

  -- Minted once, then frozen — same reasoning as the shelf slug. Renaming
  -- yourself must not break an invite link already sitting in someone's group
  -- chat, and must not orphan the attribution of a friend who hasn't clicked
  -- it yet.
  if v_code is null then
    select public.slugify(display_name) into v_base
    from public.profiles where id = v_user_id;

    v_candidate := v_base;
    while exists (select 1 from public.profiles where referral_code = v_candidate) loop
      v_candidate := v_base || '-' || v_suffix;
      v_suffix := v_suffix + 1;
    end loop;

    -- Two people with the same name minting at the same instant can both clear
    -- the loop; the unique index turns that into an error rather than a
    -- duplicate, and the client's retry picks up the next suffix.
    update public.profiles
      set referral_code = v_candidate,
          updated_at = now()
      where id = v_user_id;

    v_code := v_candidate;
  end if;

  return query
  select
    v_code,
    count(*)::int,
    count(*) filter (
      where u.email_confirmed_at is not null
        and (
          select count(*)
          from public.user_collections c
          where c.user_id = r.referred_user_id and c.owned
        ) >= public.referral_qualifying_owned()
    )::int
  from public.referrals r
  join auth.users u on u.id = r.referred_user_id
  where r.referrer_user_id = v_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recording a referral
-- ---------------------------------------------------------------------------

-- Called by the client once, right after a signup that arrived with a ?ref code
-- (see components/ReferralCapture.tsx). Returns a status string rather than
-- raising: none of the rejections are errors the user should ever see — an
-- invite that doesn't take is silent — but they're worth telling apart in a log.
--
--   claimed          — recorded
--   unknown_code     — no profile carries that code
--   self             — your own link
--   already_referred — this account is already attributed to someone
--   too_late         — the account predates the click (see below)
create or replace function public.claim_referral(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_referrer uuid;
  v_created_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select id into v_referrer
  from public.profiles
  where referral_code = nullif(trim(p_code), '');

  if v_referrer is null then
    return 'unknown_code';
  end if;

  if v_referrer = v_user_id then
    return 'self';
  end if;

  if exists (select 1 from public.referrals where referred_user_id = v_user_id) then
    return 'already_referred';
  end if;

  -- The code is stashed in localStorage when someone lands on a ?ref link, and
  -- claimed when a session appears — which is what makes it survive the email
  -- confirmation round trip and the OAuth redirect. The cost of that is that an
  -- established user who clicks a friend's link and then simply signs in would
  -- otherwise be recorded as a new referral. This window is what makes the
  -- claim mean "signed up because of this link" rather than "clicked it once".
  select created_at into v_created_at from auth.users where id = v_user_id;
  if v_created_at < now() - interval '7 days' then
    return 'too_late';
  end if;

  insert into public.referrals (referred_user_id, referrer_user_id, referral_code)
  values (v_user_id, v_referrer, trim(p_code))
  on conflict (referred_user_id) do nothing;

  return 'claimed';
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin view
-- ---------------------------------------------------------------------------

-- The leaderboard behind the raffle: who has how many qualifying entries.
-- Ordered by qualified desc so the drawing can be built straight off it.
create or replace function public.admin_referral_leaderboard()
returns table (
  user_id uuid,
  display_name text,
  referral_code text,
  joined int,
  qualified int
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.referral_code,
    count(r.referred_user_id)::int,
    count(r.referred_user_id) filter (
      where u.email_confirmed_at is not null
        and (
          select count(*)
          from public.user_collections c
          where c.user_id = r.referred_user_id and c.owned
        ) >= public.referral_qualifying_owned()
    )::int
  from public.profiles p
  join public.referrals r on r.referrer_user_id = p.id
  join auth.users u on u.id = r.referred_user_id
  where public.is_admin()
  group by p.id, p.display_name, p.referral_code
  order by 5 desc, 4 desc;
$$;
