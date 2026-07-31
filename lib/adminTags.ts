"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/supabase";
import { validateTagLabel } from "@/lib/tags";

// Editing the vocabulary itself, as opposed to which listings carry what. The
// per-listing picker can only add and remove a tag from one bobblehead; a
// typo'd label, a tag nobody wanted, and two tags that mean the same thing are
// all problems with the vocabulary, and none of them can be fixed from a
// listing page.
//
// Admin-only, and enforced in the database rather than here: "tags: admin
// update" and "tags: admin delete" in supabase/tags.sql. A rep can apply tags
// to their own team; retiring a label thirty teams are using is a different
// decision.

export type TagWriteResult = { error: string | null };

// RLS filters a forbidden write to zero rows and reports success — no error, a
// 200, and nothing changed. Every write here asks for its rows back so that
// silence becomes a visible failure instead of a dialog that closes as if it
// worked. Same guard as lib/adminEdit.ts; the wording differs because these
// writes are admin-only (a rep can't reach them at all), so an admin seeing this
// really has gone stale, while over there it may be missing team access.
function notPersisted(subject: string): string {
  return `${subject} wasn't saved — your admin access may have expired. Sign out and back in, then try again.`;
}

/**
 * Changes what a tag is called. The slug stays put: it's the identity, the URL,
 * and the join key, so renaming "star wars" to "Star Wars" must not break the
 * link anyone has already shared. A label that no longer resembles its slug is
 * the price of that, and the reason mergeTags exists — fixing a *wrong* tag is
 * a merge, not a rename.
 */
export async function renameTag(
  client: SupabaseClient,
  slug: string,
  label: string,
): Promise<TagWriteResult> {
  const validated = validateTagLabel(label);
  if ("error" in validated) return { error: validated.error };

  const { data, error } = await client
    .from("tags")
    .update({ label: validated.label })
    .eq("slug", slug)
    .select("slug");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: notPersisted("That rename") };

  return { error: null };
}

/**
 * Retires a tag. `on delete cascade` takes its assignments with it, so this
 * takes the label off every listing carrying it — which is why the caller is
 * expected to say how many that is before asking.
 */
export async function deleteTag(client: SupabaseClient, slug: string): Promise<TagWriteResult> {
  const { data, error } = await client.from("tags").delete().eq("slug", slug).select("slug");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: notPersisted("That deletion") };

  return { error: null };
}

/**
 * Folds one tag into another: every listing carrying `fromSlug` also gets
 * `intoSlug`, then `fromSlug` is retired. The answer to a vocabulary that has
 * grown "All Star Game" beside "All-Star" — deleting one of those loses the
 * listings under it, and renaming it leaves two slugs meaning one thing.
 *
 * The moves land before the delete, so a failure halfway through leaves both
 * tags standing and some listings double-tagged, which is recoverable by
 * running the merge again. The other order would drop listings on the floor.
 */
export async function mergeTags(
  client: SupabaseClient,
  {
    fromSlug,
    intoSlug,
    createdBy,
  }: { fromSlug: string; intoSlug: string; createdBy: string | null },
): Promise<TagWriteResult & { moved: number }> {
  if (fromSlug === intoSlug) {
    return { error: "Pick a different tag to merge into.", moved: 0 };
  }

  const assignments = await fetchAllPages<{ bobblehead_id: string; team_slug: string }>(
    (from, to) =>
      client
        .from("bobblehead_tags")
        .select("bobblehead_id, team_slug")
        .eq("tag_slug", fromSlug)
        .order("bobblehead_id")
        .order("team_slug")
        .range(from, to),
  );

  if (!assignments) {
    return { error: "Couldn't read what carries that tag. Nothing was changed.", moved: 0 };
  }

  if (assignments.length > 0) {
    // ignoreDuplicates because the two tags can already overlap — a listing
    // carrying both is the normal case for near-duplicates, not a conflict.
    const { error } = await client.from("bobblehead_tags").upsert(
      assignments.map((row) => ({
        bobblehead_id: row.bobblehead_id,
        team_slug: row.team_slug,
        tag_slug: intoSlug,
        created_by: createdBy,
      })),
      { onConflict: "bobblehead_id,team_slug,tag_slug", ignoreDuplicates: true },
    );

    if (error) {
      return { error: `${error.message} — nothing was changed.`, moved: 0 };
    }
  }

  const deleted = await deleteTag(client, fromSlug);
  if (deleted.error) {
    return {
      error: `${assignments.length} listings were moved, but the old tag couldn't be deleted: ${deleted.error}`,
      moved: assignments.length,
    };
  }

  return { error: null, moved: assignments.length };
}
