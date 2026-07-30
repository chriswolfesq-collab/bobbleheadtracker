-- Tags: the cross-cutting labels the catalog has no other way to express.
-- "Sugar Skull", "Star Wars", "Peanuts", "Game of Thrones" — a Grogu bobblehead
-- is a Star Wars bobblehead whether it was given away by the Nationals or the
-- Athletics, and nothing in a team-and-year catalog says so. Idempotent — safe
-- to run more than once. Paste into the Supabase SQL editor.
--
-- Two tables rather than a text[] column on each listing: a shared vocabulary
-- is the whole point. A free-text array gives you "Star Wars", "star wars" and
-- "StarWars" as three different things within a week, and no way to rename all
-- of them at once.

-- 1. The vocabulary. The slug is the identity and the URL; the label is what
--    gets rendered, so casing and punctuation can be fixed without breaking a
--    link anyone has shared.
create table if not exists public.tags (
  slug text primary key,
  label text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

-- Shape enforced in the database as well as in lib/tags.ts, because the slug
-- goes straight into a URL and is the join key.
alter table public.tags drop constraint if exists tags_slug_shape_check;
alter table public.tags
  add constraint tags_slug_shape_check
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40);

alter table public.tags drop constraint if exists tags_label_check;
alter table public.tags
  add constraint tags_label_check
  check (char_length(btrim(label)) between 2 and 40);

-- 2. What carries which tag. team_slug is denormalized onto the join row so
--    the RLS policy can authorize a team rep without joining out to find which
--    team the listing belongs to — and because a curated listing has no row of
--    its own to join to in the first place.
--
--    It's in the key as well, because a bobblehead id is only unique within a
--    team: 36 ids are shared between teams, and elmo-2023 belongs to five of
--    them. It takes both columns to name one listing. Keyed on bobblehead_id
--    alone, tagging Elmo "Sesame Street" would label one team's and silently
--    drop the other four. See supabase/fix_bobblehead_tags_pk.sql — this file
--    is `if not exists`, so editing it does nothing to a database that already
--    has the table.
create table if not exists public.bobblehead_tags (
  bobblehead_id text not null,
  team_slug text not null,
  tag_slug text not null references public.tags (slug) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  primary key (bobblehead_id, team_slug, tag_slug)
);

-- Browsing a tag reads by tag_slug; a listing page reads by bobblehead_id,
-- which the primary key's leading column already covers.
create index if not exists bobblehead_tags_tag_slug_idx
  on public.bobblehead_tags (tag_slug);
create index if not exists bobblehead_tags_team_slug_idx
  on public.bobblehead_tags (team_slug);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.tags enable row level security;
alter table public.bobblehead_tags enable row level security;

-- Readable by everyone, signed in or not: tags are part of the public catalog,
-- and a tag page has to render for a crawler.
drop policy if exists "tags: public read" on public.tags;
create policy "tags: public read"
  on public.tags for select
  to anon, authenticated
  using (true);

-- Anyone trusted to edit a listing can mint a tag, because you can't apply one
-- that doesn't exist yet. That's admins and team reps — not the public, since
-- an open vocabulary is exactly the mess the two-table shape exists to avoid.
drop policy if exists "tags: editor insert" on public.tags;
create policy "tags: editor insert"
  on public.tags for insert
  to authenticated
  with check (public.is_admin() or public.is_team_rep());

-- Renaming and deleting are admin-only. A rep needs to label their own team's
-- bobbleheads; retiring a label that thirty teams are using is a different
-- decision, and `on delete cascade` means it takes the assignments with it.
drop policy if exists "tags: admin update" on public.tags;
create policy "tags: admin update"
  on public.tags for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "tags: admin delete" on public.tags;
create policy "tags: admin delete"
  on public.tags for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "bobblehead_tags: public read" on public.bobblehead_tags;
create policy "bobblehead_tags: public read"
  on public.bobblehead_tags for select
  to anon, authenticated
  using (true);

-- can_edit_team is true for an admin on every team and for a rep on their own,
-- so this is the same rule the listing edit dialog already runs on.
drop policy if exists "bobblehead_tags: editor insert" on public.bobblehead_tags;
create policy "bobblehead_tags: editor insert"
  on public.bobblehead_tags for insert
  to authenticated
  with check (public.can_edit_team(team_slug));

drop policy if exists "bobblehead_tags: editor delete" on public.bobblehead_tags;
create policy "bobblehead_tags: editor delete"
  on public.bobblehead_tags for delete
  to authenticated
  using (public.can_edit_team(team_slug));

-- ---------------------------------------------------------------------------
-- Counts
-- ---------------------------------------------------------------------------

-- How many listings carry each tag, for the tag directory. A view rather than a
-- maintained counter column: the join table is small, the count is cheap, and a
-- counter is one more thing that can drift out of step with what it counts.
--
-- security_invoker so the view is read under the caller's own policies rather
-- than the definer's — the rows are public either way, but a view that quietly
-- escalates is a habit worth not forming.
drop view if exists public.tag_counts;
create view public.tag_counts
  with (security_invoker = true)
  as
  select t.slug, t.label, count(bt.bobblehead_id) as listing_count
    from public.tags t
    left join public.bobblehead_tags bt on bt.tag_slug = t.slug
    group by t.slug, t.label;

grant select on public.tag_counts to anon, authenticated;
