-- Team reps can put an already-approved tag on their own team's listings.
-- Idempotent — safe to run more than once. Paste into the Supabase SQL editor.
--
-- rep_tag_removal.sql reopened removal to the team's rep on the grounds that
-- taking a tag off one listing decides nothing about the shared vocabulary. The
-- same argument cuts the *adding* side in two, which that file drew the line
-- straight through: minting "Star Wars" is a decision about all thirty teams,
-- but putting the existing "Star Wars" on this Dodgers bobblehead is not. That
-- is the same one-listing judgement removal is, made by the same person who is
-- best placed to make it. Sending it to /admin/tag-requests bought no review of
-- the vocabulary — the label was already in it — and cost the admin a queue.
--
-- So the line moves from add/remove to mint/apply:
--   tags insert             admin only  (unchanged — the vocabulary is curated)
--   bobblehead_tags insert  this team's rep, of a tag that already exists
--   bobblehead_tags delete  this team's rep  (rep_tag_removal.sql)
--
-- What keeps "a tag that already exists" honest is the foreign key, not a new
-- check: tag_slug references tags(slug), and a rep still can't insert there. A
-- rep naming a label the vocabulary doesn't have gets 23503 from the FK rather
-- than quietly minting it. Their route for a new label is a tag_requests row,
-- which is now the only thing that queue carries from a rep.

-- ---------------------------------------------------------------------------
-- The policy
-- ---------------------------------------------------------------------------

-- team_slug is on the row itself — the same denormalization (see tags.sql) the
-- delete policy authorizes with, and the reason a curated listing with no row
-- of its own is covered too. can_edit_team() folds the admin in, so this widens
-- who can insert rather than replacing them.
drop policy if exists "bobblehead_tags: admin insert" on public.bobblehead_tags;
drop policy if exists "bobblehead_tags: editor insert" on public.bobblehead_tags;
create policy "bobblehead_tags: editor insert"
  on public.bobblehead_tags for insert
  to authenticated
  with check (public.can_edit_team(team_slug));

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------
-- The mirror of log_tag_removed in rep_tag_removal.sql. No cascade to tell
-- apart here — an insert can't outrun its own foreign key, so the tags row is
-- always there — and created_by is the right fallback actor on this side,
-- because on an insert it is whoever is doing the thing being logged.
create or replace function public.log_tag_applied()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  select label into v_label from public.tags where slug = new.tag_slug;

  perform public.log_rep_activity(
    'tag_added', new.team_slug, new.bobblehead_id,
    'Added the ' || coalesce(v_label, new.tag_slug) || ' tag to ' || new.bobblehead_id,
    new.created_by);
  return new;
end;
$$;

drop trigger if exists log_bobblehead_tag_applied on public.bobblehead_tags;
create trigger log_bobblehead_tag_applied
  after insert on public.bobblehead_tags
  for each row
  execute function public.log_tag_applied();
