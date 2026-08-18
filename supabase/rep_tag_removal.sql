-- Team reps can take a tag off their own team's listings.
-- Idempotent — safe to run more than once. Paste into the Supabase SQL editor.
--
-- tag_requests.sql closed every tag write to admins, removal included, on the
-- reasoning that "a rep who could strip an approved tag could undo the review".
-- That holds for the vocabulary but not for one listing: minting "Star Wars" is
-- a decision about all thirty teams, while whether *this* Dodgers bobblehead is
-- a Star Wars bobblehead is exactly the thing that team's rep knows best. A
-- wrong tag on their page was previously theirs to notice and nobody's to fix
-- short of the admin.
--
-- So the two halves split: adding still goes through tag_requests (a rep can't
-- mint, and can't apply), removing is scoped to the teams the rep already
-- edits. can_edit_team() folds the admin in, so this widens the policy rather
-- than replacing who could already do it.

-- ---------------------------------------------------------------------------
-- The policy
-- ---------------------------------------------------------------------------

-- team_slug is on the row itself — that denormalization (see tags.sql) is what
-- lets this authorize without joining out to find the listing's team, and it's
-- why a curated listing with no row of its own is covered too.
drop policy if exists "bobblehead_tags: admin delete" on public.bobblehead_tags;
drop policy if exists "bobblehead_tags: editor delete" on public.bobblehead_tags;
create policy "bobblehead_tags: editor delete"
  on public.bobblehead_tags for delete
  to authenticated
  using (public.can_edit_team(team_slug));

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------
-- A new rep-facing write path, so it drops a row into rep_activity like every
-- other one (see rep_activity.sql for why this is a trigger and not app code).
create or replace function public.log_tag_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  -- Deleting a tag from the vocabulary cascades to every listing carrying it,
  -- which would write one log row per listing for a single admin gesture. The
  -- parent row is already gone by the time the cascade reaches here, so a
  -- missing label is how a cascade is told apart from a rep clicking the ×.
  select label into v_label from public.tags where slug = old.tag_slug;
  if not found then
    return old;
  end if;

  -- No fallback actor: created_by is whoever *added* the tag, and crediting
  -- them with its removal would be worse than the null auth.uid() covers.
  perform public.log_rep_activity(
    'tag_removed', old.team_slug, old.bobblehead_id,
    'Removed the ' || v_label || ' tag from ' || old.bobblehead_id);
  return old;
end;
$$;

drop trigger if exists log_bobblehead_tag_removed on public.bobblehead_tags;
create trigger log_bobblehead_tag_removed
  after delete on public.bobblehead_tags
  for each row
  execute function public.log_tag_removed();
