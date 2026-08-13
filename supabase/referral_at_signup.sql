-- Attribute a referral the moment the account row exists, not when it first
-- gets a session.
--
-- Run after referrals.sql. Idempotent — safe to re-run.
--
-- Why: claim_referral() needs auth.uid(), so it cannot run until the new
-- account has a session. With email confirmation on, signUp creates the
-- auth.users row and no session — the account has, by any ordinary reading,
-- signed up, but nothing is recorded. It stays unrecorded until the
-- confirmation link is clicked, and only then if that link happens to open in
-- the same browser profile that stashed the code; a mail app's built-in
-- browser has its own localStorage and finds nothing there.
--
-- On 2026-08-13 that gap was live: one signup sat unconfirmed and therefore
-- unattributed, and three confirmed signups arrived with no referral row at
-- all, indistinguishable from organic ones.
--
-- lib/auth.tsx now passes the code through signUp's user_metadata, so it is
-- present on the INSERT itself and this trigger can do the work with no
-- session in the picture. claim_referral() stays as the fallback for the OAuth
-- path (which takes no metadata) and for anyone mid-signup when this shipped.

create or replace function public.attribute_referral_from_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := nullif(trim(new.raw_user_meta_data ->> 'referral_code'), '');
  v_referrer uuid;
begin
  if v_code is null then
    return new;
  end if;

  select id into v_referrer from public.profiles where referral_code = v_code;

  -- Same guards as claim_referral, minus the account-age window: this fires on
  -- the INSERT, so the account is definitionally new. An unknown code is
  -- ignored rather than raised — a bad ?ref in a shared link must never be
  -- able to stop someone signing up.
  if v_referrer is null or v_referrer = new.id then
    return new;
  end if;

  insert into public.referrals (referred_user_id, referrer_user_id, referral_code)
  values (new.id, v_referrer, v_code)
  on conflict (referred_user_id) do nothing;

  return new;
end;
$$;

-- Separate from sync_profile_from_auth rather than folded into it: that one
-- fires on INSERT OR UPDATE OF raw_user_meta_data, and re-running attribution
-- every time somebody edits their display name is not wanted. This is
-- insert-only.
--
-- AFTER INSERT so the profiles row that sync_profile_from_auth creates already
-- exists; referrals references auth.users rather than profiles, so this is
-- ordering hygiene rather than a hard dependency. Triggers on the same event
-- fire in name order, and 'a' sorts before 's'... which is the wrong way
-- round, so the referrer lookup reads profiles for the *referrer*, a row that
-- has existed since they minted their code. The new user's own profile row is
-- irrelevant here.
drop trigger if exists attribute_referral_from_signup on auth.users;
create trigger attribute_referral_from_signup
  after insert on auth.users
  for each row execute function public.attribute_referral_from_signup();

-- Backfill: anyone who signed up with a code in their metadata before this
-- trigger existed. Safe to re-run; the primary key makes it a no-op for
-- accounts already attributed.
insert into public.referrals (referred_user_id, referrer_user_id, referral_code)
select u.id, p.id, nullif(trim(u.raw_user_meta_data ->> 'referral_code'), '')
from auth.users u
join public.profiles p
  on p.referral_code = nullif(trim(u.raw_user_meta_data ->> 'referral_code'), '')
where nullif(trim(u.raw_user_meta_data ->> 'referral_code'), '') is not null
  and p.id <> u.id
on conflict (referred_user_id) do nothing;
