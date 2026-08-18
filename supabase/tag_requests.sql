-- Tag requests: the vocabulary is admin-curated now. Reps used to mint and
-- apply tags themselves ("tags: editor insert" in tags.sql), which is how the
-- duplicate-tags queue filled up — this replaces that direct write with a
-- request the admin approves or rejects from /admin/tag-requests. Asking is
-- open to any signed-in user, not just reps; the admin is the only writer
-- either way. Idempotent — safe to run more than once. Paste into the Supabase
-- SQL editor.

-- 1. The queue. One row per (listing, proposed tag, requester). label/slug are
--    validated to the same shape as tags itself so an approval can't fail the
--    vocabulary's checks. source is 'curated' | 'community', because the two
--    kinds of listing live at different URLs and the review page needs to link
--    to the right one — same reason listing_reports carries it.
create table if not exists public.tag_requests (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  slug text not null,
  bobblehead_id text not null,
  team_slug text not null,
  source text not null default 'curated' check (source in ('curated', 'community')),
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.tag_requests drop constraint if exists tag_requests_slug_shape_check;
alter table public.tag_requests
  add constraint tag_requests_slug_shape_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40);

alter table public.tag_requests drop constraint if exists tag_requests_label_check;
alter table public.tag_requests
  add constraint tag_requests_label_check
  check (char_length(btrim(label)) between 2 and 40);

-- Asking twice for the same tag on the same listing is a double-click, not two
-- requests. Scoped to pending so a rejected request can be re-asked later if
-- the admin changes their mind about the vocabulary.
create unique index if not exists tag_requests_pending_unique
  on public.tag_requests (bobblehead_id, slug, requested_by)
  where status = 'pending';

-- The review page reads the pending queue; everything else is by requester.
create index if not exists tag_requests_status_idx on public.tag_requests (status);
create index if not exists tag_requests_requested_by_idx on public.tag_requests (requested_by);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.tag_requests enable row level security;

-- Any signed-in user can ask, on any listing — knowing that a bobblehead is a
-- Star Wars bobblehead doesn't require being that team's rep, and the whole
-- point of a review queue is that asking is cheap and safe. Not anon: a request
-- has to be attributable to somebody, both to rate-limit it and to tell them
-- what happened. The old policy name is dropped explicitly because renaming a
-- policy doesn't replace the old one.
drop policy if exists "tag_requests: editor insert own" on public.tag_requests;
drop policy if exists "tag_requests: insert own" on public.tag_requests;
create policy "tag_requests: insert own"
  on public.tag_requests for insert
  to authenticated
  with check (requested_by = (select auth.uid()));

-- Now that anyone signed in can ask, the queue is a public write path like
-- submissions and listing_reports, so it gets the same throttle: a BEFORE
-- INSERT trigger counting the user's own recent rows, SECURITY DEFINER so the
-- count sees every row regardless of the select policy above, and SQLSTATE
-- BB429 so lib/rateLimit.ts can swap in friendly copy. Same shape and
-- thresholds as enforce_report_rate_limit in supabase/rate_limit.sql — a tag
-- request is about as cheap and about as spammable as a report.
--
-- The partial unique index above already stops the same ask repeating; this is
-- what stops a hundred different ones.
create or replace function public.enforce_tag_request_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_hour int;
  v_last_day int;
begin
  select count(*) into v_last_hour
  from public.tag_requests
  where requested_by = new.requested_by
    and created_at > now() - interval '1 hour';

  select count(*) into v_last_day
  from public.tag_requests
  where requested_by = new.requested_by
    and created_at > now() - interval '24 hours';

  if v_last_hour >= 10 or v_last_day >= 50 then
    raise exception 'You''re requesting tags too quickly. Please wait a bit and try again.'
      using errcode = 'BB429';
  end if;

  return new;
end;
$$;

drop trigger if exists rate_limit_tag_requests on public.tag_requests;
create trigger rate_limit_tag_requests
  before insert on public.tag_requests
  for each row
  execute function public.enforce_tag_request_rate_limit();

-- A requester sees their own (the listing page shows "pending review"); the
-- admin sees the whole queue.
drop policy if exists "tag_requests: own or admin read" on public.tag_requests;
create policy "tag_requests: own or admin read"
  on public.tag_requests for select
  to authenticated
  using (requested_by = (select auth.uid()) or public.is_admin());

-- Ruling on a request is the admin's alone.
drop policy if exists "tag_requests: admin update" on public.tag_requests;
create policy "tag_requests: admin update"
  on public.tag_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "tag_requests: admin delete" on public.tag_requests;
create policy "tag_requests: admin delete"
  on public.tag_requests for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Tighten the tag tables themselves: minting and applying are admin-only now.
-- These replace the editor policies created in tags.sql.
-- ---------------------------------------------------------------------------

drop policy if exists "tags: editor insert" on public.tags;
drop policy if exists "tags: admin insert" on public.tags;
create policy "tags: admin insert"
  on public.tags for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "bobblehead_tags: editor insert" on public.bobblehead_tags;
drop policy if exists "bobblehead_tags: admin insert" on public.bobblehead_tags;
create policy "bobblehead_tags: admin insert"
  on public.bobblehead_tags for insert
  to authenticated
  with check (public.is_admin());

-- Removal is not: supabase/rep_tag_removal.sql later reopened it to the team's
-- own rep, since taking a wrong tag off one listing decides nothing about the
-- shared vocabulary. Restated here so re-running this file doesn't undo that.
drop policy if exists "bobblehead_tags: editor delete" on public.bobblehead_tags;
drop policy if exists "bobblehead_tags: admin delete" on public.bobblehead_tags;
create policy "bobblehead_tags: editor delete"
  on public.bobblehead_tags for delete
  to authenticated
  using (public.can_edit_team(team_slug));
