-- Per-item details on an owned bobblehead: condition, when you got it, what you
-- paid, and a free-text note. Turns the owned flag from a checkbox into a
-- record of the actual thing on your shelf. Idempotent — safe to run more than
-- once. Paste into the Supabase SQL editor.
--
-- No new table and no new policies: these are columns on the row that already
-- says you own it, so the existing user_collections RLS (owner select/insert/
-- update, plus the additive admin read) covers them unchanged. That also means
-- a detail can never outlive its ownership row or belong to someone else.

alter table public.user_collections
  add column if not exists condition text,
  add column if not exists acquired_on date,
  add column if not exists price_paid numeric(10, 2),
  add column if not exists notes text;

-- Condition is a closed set rather than free text: the whole point is being
-- able to count how much of a shelf is still boxed, which free text can't
-- answer. Null means "not recorded" and stays distinct from either answer.
alter table public.user_collections
  drop constraint if exists user_collections_condition_check;
alter table public.user_collections
  add constraint user_collections_condition_check
  check (condition is null or condition in ('in_box', 'out_of_box'));

-- Guard rails on the two free-ish fields. numeric(10,2) already caps the
-- magnitude; this rules out the negative price that a stray minus sign in the
-- number input would otherwise persist.
alter table public.user_collections
  drop constraint if exists user_collections_price_paid_check;
alter table public.user_collections
  add constraint user_collections_price_paid_check
  check (price_paid is null or price_paid >= 0);

-- A note is a note, not an essay — bounded so one row can't be used to park
-- megabytes in a table every collection read touches.
alter table public.user_collections
  drop constraint if exists user_collections_notes_check;
alter table public.user_collections
  add constraint user_collections_notes_check
  check (notes is null or char_length(notes) <= 2000);
