-- Team-rep authorization test. Paste into the Supabase SQL editor and Run.
-- Everything happens inside one transaction that ROLLS BACK at the end: it
-- creates no accounts, leaves no rep assignment, and writes no real data.
--
-- It simulates three identities by setting the JWT email claim, then checks:
--   * the auth functions (is_admin / is_team_rep / can_edit_team), which every
--     RLS policy and RPC keys off of, and
--   * real RLS enforcement on an actual insert as the `authenticated` role.
--
-- Read the final result grid: every row's `pass` column should be TRUE.

begin;

create temp table _t (ctx text, check_name text, got boolean, expect boolean) on commit drop;

-- Assign a throwaway Padres rep (direct insert; rolled back with the txn).
insert into public.team_reps (email, team_slug) values ('reptest@example.com', 'padres');

-- --- Identity 1: the Padres rep ------------------------------------------
select set_config('request.jwt.claims', '{"email":"reptest@example.com"}', true);
insert into _t values
  ('padres rep', 'is_admin is false',            public.is_admin(),               false),
  ('padres rep', 'is_team_rep is true',          public.is_team_rep(),            true),
  ('padres rep', 'can edit padres (own)',        public.can_edit_team('padres'),  true),
  ('padres rep', 'cannot edit yankees (other)',  public.can_edit_team('yankees'), false);

-- --- Identity 2: an unrelated signed-in user -----------------------------
select set_config('request.jwt.claims', '{"email":"stranger@example.com"}', true);
insert into _t values
  ('stranger', 'is_team_rep is false',       public.is_team_rep(),           false),
  ('stranger', 'cannot edit padres',         public.can_edit_team('padres'), false);

-- --- Identity 3: the full admin ------------------------------------------
select set_config('request.jwt.claims', '{"email":"chriswolfesq@gmail.com"}', true);
insert into _t values
  ('admin', 'is_admin is true',        public.is_admin(),               true),
  ('admin', 'can edit any team',       public.can_edit_team('yankees'), true);

-- --- Real RLS enforcement as the `authenticated` role, acting as the rep --
do $$
declare own_ok boolean := false; other_blocked boolean := false;
begin
  perform set_config('request.jwt.claims', '{"email":"reptest@example.com","role":"authenticated"}', true);
  set local role authenticated;

  begin
    insert into public.bobblehead_overrides (team_slug, bobblehead_id, title)
    values ('padres', '__rlstest_own__', 'x');
    own_ok := true;                       -- RLS let the rep write their own team
  exception when others then own_ok := false; end;

  begin
    insert into public.bobblehead_overrides (team_slug, bobblehead_id, title)
    values ('yankees', '__rlstest_other__', 'x');
    other_blocked := false;               -- should never reach here
  exception when others then other_blocked := true; end;  -- RLS blocked it

  reset role;                             -- back to owner before touching _t
  insert into _t values
    ('rls (rep)', 'RLS allows write to own team (padres)',     own_ok,        true),
    ('rls (rep)', 'RLS blocks write to other team (yankees)',  other_blocked, true);
end $$;

select ctx, check_name, got, expect, (got = expect) as pass
from _t
order by ctx, check_name;

rollback;
