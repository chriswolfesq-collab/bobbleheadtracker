-- Reviewed duplicate-tag pairs. Idempotent — safe to run more than once. Paste
-- into the Supabase SQL editor.
--
-- The pairs themselves aren't stored: which tags look like one idea twice is
-- derived from the vocabulary every time (lib/tagSimilarity.ts), so a pair
-- appears the moment a near-duplicate is minted and disappears the moment the
-- two are merged — no queue to keep in step with the thing it describes, and
-- pairs that predate the feature are in it from the first load.
--
-- What can't be derived is a judgement. "Dogs" and "Hot Dogs" really are two
-- tags; an admin who has said so once shouldn't be asked again. That's all this
-- table is: the pairs a human has already ruled on, so the review queue can
-- show what's left.

create table if not exists public.tag_duplicate_dismissals (
  -- Ordered pair, enforced below, so one pair has one row however it was found.
  slug_a text not null references public.tags (slug) on delete cascade,
  slug_b text not null references public.tags (slug) on delete cascade,
  -- Why they looked alike when dismissed, for the record — the detector's
  -- verdict can change as its rules do, and a stale reason is still a clue.
  reason text,
  dismissed_by uuid references auth.users (id),
  dismissed_at timestamptz not null default now(),
  primary key (slug_a, slug_b)
);

-- Deleting either tag takes the dismissal with it (the FKs above), which is
-- what makes merging a pair self-cleaning: the losing tag goes, and so does
-- any ruling about it.

alter table public.tag_duplicate_dismissals
  drop constraint if exists tag_duplicate_dismissals_order_check;
alter table public.tag_duplicate_dismissals
  add constraint tag_duplicate_dismissals_order_check check (slug_a < slug_b);

alter table public.tag_duplicate_dismissals enable row level security;

-- Admin-only, read included: this is a review queue, not part of the catalog.
-- Editing the vocabulary is already admin-only (supabase/tags.sql), so ruling
-- on it is too.
drop policy if exists "tag duplicate dismissals: admin select" on public.tag_duplicate_dismissals;
create policy "tag duplicate dismissals: admin select"
  on public.tag_duplicate_dismissals for select
  to authenticated
  using (public.is_admin());

drop policy if exists "tag duplicate dismissals: admin insert" on public.tag_duplicate_dismissals;
create policy "tag duplicate dismissals: admin insert"
  on public.tag_duplicate_dismissals for insert
  to authenticated
  with check (public.is_admin());

-- Undoing a dismissal is a delete, so an admin who rules on a pair by mistake
-- can put it back in the queue.
drop policy if exists "tag duplicate dismissals: admin delete" on public.tag_duplicate_dismissals;
create policy "tag duplicate dismissals: admin delete"
  on public.tag_duplicate_dismissals for delete
  to authenticated
  using (public.is_admin());
