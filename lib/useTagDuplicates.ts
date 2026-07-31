"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TagWithCount } from "@/lib/tags";
import { type DuplicatePair, findDuplicatePairs, type SimilarityReason } from "@/lib/tagSimilarity";
import { useTagVocabulary } from "@/lib/useTags";

// The review queue behind /admin/duplicate-tags.
//
// The pairs are derived from the vocabulary rather than logged when a tag is
// minted, so the queue can't drift from what the vocabulary actually contains:
// a near-duplicate shows up the moment it exists (whether or not whoever minted
// it saw the warning), and a merged pair leaves the queue because there's no
// longer a pair. What's stored is only the judgement — see
// supabase/tag_duplicates.sql.

export type ReviewablePair = DuplicatePair<TagWithCount> & {
  /** When the newer of the two was minted, for "this one is new" in the UI. */
  newerCreatedAt: string | null;
  dismissedAt: string | null;
};

type DismissalRow = { slug_a: string; slug_b: string; dismissed_at: string };

// tag_duplicate_dismissals is new enough that it isn't in the generated
// database types (and won't be until supabase/tag_duplicates.sql has been run
// and the types regenerated), so this one table goes through an untyped view of
// the client — the same escape hatch lib/useUserFlagMap.ts uses. Every other
// query on this page keeps its typing.
const untyped = supabase as unknown as SupabaseClient;

// PostgREST's code for "relation does not exist", plus the shape supabase-js
// gives an unknown table it can't find in its schema cache. Either means the
// migration hasn't been run, which is a setup note rather than an error.
function isMissingTable(error: { code?: string; message: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || /does not exist|schema cache/i.test(error.message);
}

export function useTagDuplicates(
  // The admin dashboard needs the count for its badge, but it renders for team
  // reps too, and a rep can neither see the rulings nor act on a pair. Off by
  // default is wrong (every real caller wants it on); a way to switch it off is
  // what keeps three reads from happening for someone who can't use them.
  { enabled = true }: { enabled?: boolean } = {},
): {
  open: ReviewablePair[];
  dismissed: ReviewablePair[];
  isLoading: boolean;
  /** supabase/tag_duplicates.sql hasn't been run — detection works, rulings can't be saved. */
  needsSetup: boolean;
  dismiss: (pair: ReviewablePair) => Promise<{ error: string | null }>;
  restore: (pair: ReviewablePair) => Promise<{ error: string | null }>;
  reload: () => void;
} {
  const { tags, isLoading: isLoadingTags, reload: reloadTags } = useTagVocabulary();
  const [createdAtBySlug, setCreatedAtBySlug] = useState<Record<string, string>>({});
  const [dismissals, setDismissals] = useState<Map<string, string>>(new Map());
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    Promise.all([
      supabase.from("tags").select("slug, created_at"),
      untyped.from("tag_duplicate_dismissals").select("slug_a, slug_b, dismissed_at"),
    ]).then(([created, dismissed]) => {
      if (cancelled) return;

      if (created.error) {
        console.error("Failed to load when tags were created:", created.error.message);
        setCreatedAtBySlug({});
      } else {
        setCreatedAtBySlug(
          Object.fromEntries((created.data ?? []).map((row) => [row.slug, row.created_at])),
        );
      }

      if (dismissed.error) {
        setNeedsSetup(isMissingTable(dismissed.error));
        if (!isMissingTable(dismissed.error)) {
          console.error("Failed to load dismissed pairs:", dismissed.error.message);
        }
        setDismissals(new Map());
      } else {
        setNeedsSetup(false);
        setDismissals(
          new Map(
            ((dismissed.data ?? []) as unknown as DismissalRow[]).map((row) => [
              `${row.slug_a}|${row.slug_b}`,
              row.dismissed_at,
            ]),
          ),
        );
      }

      setIsLoadingReviews(false);
    });

    return () => {
      cancelled = true;
    };
  }, [nonce, enabled]);

  const pairs = useMemo(() => {
    if (!enabled) return [];

    // The newer half of the pair is what an admin is actually judging — "should
    // this have been created?" — so the pair carries the later of the two dates.
    const newerOf = (a: string, b: string): string | null => {
      const first = createdAtBySlug[a] ?? null;
      const second = createdAtBySlug[b] ?? null;
      if (!first) return second;
      if (!second) return first;
      return first > second ? first : second;
    };

    return findDuplicatePairs(tags).map((pair) => ({
      ...pair,
      newerCreatedAt: newerOf(pair.a.slug, pair.b.slug),
      dismissedAt: dismissals.get(pair.key) ?? null,
    }));
  }, [enabled, tags, createdAtBySlug, dismissals]);

  const reload = useCallback(() => {
    reloadTags();
    setNonce((current) => current + 1);
  }, [reloadTags]);

  const dismiss = useCallback(
    async (pair: ReviewablePair) => {
      const { error } = await untyped
        .from("tag_duplicate_dismissals")
        .insert({ slug_a: pair.a.slug, slug_b: pair.b.slug, reason: pair.reason });

      if (error) return { error: error.message };

      reload();
      return { error: null };
    },
    [reload],
  );

  const restore = useCallback(
    async (pair: ReviewablePair) => {
      const { error } = await untyped
        .from("tag_duplicate_dismissals")
        .delete()
        .eq("slug_a", pair.a.slug)
        .eq("slug_b", pair.b.slug);

      if (error) return { error: error.message };

      reload();
      return { error: null };
    },
    [reload],
  );

  return {
    open: pairs.filter((pair) => !pair.dismissedAt),
    dismissed: pairs.filter((pair) => pair.dismissedAt),
    isLoading: enabled ? isLoadingTags || isLoadingReviews : false,
    needsSetup,
    dismiss,
    restore,
    reload,
  };
}

/** How recently the newer half of a pair was minted, or null if unknown. */
export function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.floor((now - at) / 86_400_000));
}

export type { SimilarityReason };
