"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import {
  type BobbleheadIdentity,
  buildBobbleheadResolver,
  listingKey,
} from "@/lib/bobbleheadIdentity";
import { useBobbleheadOverrides } from "@/lib/bobbleheadOverrides";
import { getGiveawayById } from "@/lib/bobbleheads";
import { useOwnedKeys } from "@/lib/profile";
import { fetchAllPages, supabase } from "@/lib/supabase";
import { submitTagRequest, type TagRequestSource } from "@/lib/tagRequests";
import {
  chooseTagExamples,
  sortTags,
  type Tag,
  type TagAssignment,
  type TagWithCount,
  validateTagLabel,
} from "@/lib/tags";

// Reads and writes for tags. The vocabulary and the assignments are two
// separate reads because they're wanted in different places — the picker needs
// every tag that exists, a listing page needs the handful on one bobblehead,
// and search needs all the assignments at once.

/** Keyed `${teamSlug}:${bobbleheadId}`, matching the other cross-team lookups. */
export type TagsByKey = Record<string, Tag[]>;

type AssignmentRow = {
  bobblehead_id: string;
  team_slug: string;
  tag_slug: string;
  tags: { label: string } | null;
};

// Every row of bobblehead_tags, in pages.
//
// The whole table, deliberately: it's one row per (listing, tag), it's public,
// and a limit here means search silently not matching whatever fell off the end
// — which is exactly what the single unpaged read this replaced was doing once
// the table passed 1,000 assignments. Ordered by the primary key so no page
// boundary repeats or skips a row. If it ever outgrows paging, the fix is a
// server-side search, not a limit.
function fetchAllAssignmentRows<T>(columns: string): Promise<T[] | null> {
  return fetchAllPages<T>((from, to) =>
    supabase
      .from("bobblehead_tags")
      // Widened to `string` so supabase-js doesn't try to parse the caller's
      // column list as a literal select expression, which is also what costs
      // this the row type — hence the cast on the way out.
      .select(columns as string)
      .order("bobblehead_id")
      .order("team_slug")
      .order("tag_slug")
      .range(from, to)
      .then(({ data, error }) => ({ data: (data ?? null) as T[] | null, error })),
  );
}

// Every assignment, joined to its label. Feeds the search index, which has to
// be able to match a tag on any listing without knowing in advance which
// listings the user will type towards.
export function useAllBobbleheadTags(): { tagsByKey: TagsByKey; isLoading: boolean } {
  const [tagsByKey, setTagsByKey] = useState<TagsByKey>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchAllAssignmentRows<AssignmentRow>("bobblehead_id, team_slug, tag_slug, tags(label)").then(
      (rows) => {
        if (cancelled) return;

        if (!rows) {
          // Search and the listing pages both degrade to "no tags" rather than
          // breaking, which is why this doesn't toast: nobody asked for tags,
          // they asked for a search box.
          setTagsByKey({});
        } else {
          const map: TagsByKey = {};
          for (const row of rows) {
            const key = listingKey(row.team_slug, row.bobblehead_id);
            (map[key] ??= []).push({
              slug: row.tag_slug,
              // A missing join row would mean a tag deleted mid-read; the slug
              // is a readable enough stand-in that it beats dropping the row.
              label: row.tags?.label ?? row.tag_slug,
            });
          }
          for (const key of Object.keys(map)) map[key] = sortTags(map[key]);
          setTagsByKey(map);
        }

        setIsLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return { tagsByKey, isLoading };
}

// The vocabulary with how many listings carry each, for the tag directory and
// the picker's suggestions.
export function useTagVocabulary(): {
  tags: TagWithCount[];
  isLoading: boolean;
  reload: () => void;
} {
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("tag_counts")
      .select("slug, label, listing_count")
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load the tag list:", error.message);
          setTags([]);
        } else {
          setTags(
            sortTags(
              (data ?? [])
                // The view's columns are nullable to the type generator because
                // it can't see that they come from a not-null primary key.
                .filter((row) => row.slug && row.label)
                .map((row) => ({
                  slug: row.slug as string,
                  label: row.label as string,
                  listingCount: row.listing_count ?? 0,
                })),
            ),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((current) => current + 1), []);

  return { tags, isLoading, reload };
}

// Every assignment as a plain pair, without the label join useAllBobbleheadTags
// needs — this is the set the directory counts progress against and picks its
// example photos from, and both only care about which listings carry what.
function useTagAssignments(): { assignments: TagAssignment[] | null } {
  const [assignments, setAssignments] = useState<TagAssignment[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchAllAssignmentRows<Omit<AssignmentRow, "tags">>(
      "bobblehead_id, team_slug, tag_slug",
    ).then((rows) => {
      if (cancelled) return;

      setAssignments(
        (rows ?? []).map((row) => ({
          teamSlug: row.team_slug,
          bobbleheadId: row.bobblehead_id,
          tagSlug: row.tag_slug,
        })),
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { assignments };
}

// A curated listing with a seed photo makes the best example: it's certain to
// have a picture, and it's the picture the rest of the site already shows for
// it. A community listing is the next best guess — it usually carries the photo
// whoever submitted it took, which the resolver picks up. A curated listing with
// no photo comes last, since it renders as the team silhouette and illustrates
// nothing at all.
function rankAsExample(assignment: TagAssignment): number {
  const curated = getGiveawayById(assignment.bobbleheadId, assignment.teamSlug);
  if (!curated) return 1;
  return curated.imageUrl ? 2 : 0;
}

export type TagDirectoryEntry = TagWithCount & {
  /** One bobblehead carrying the tag, shown beside it as an example. */
  example: BobbleheadIdentity | null;
  /** How many of the tag's listings the signed-in user owns. */
  ownedCount: number;
};

// The tag directory: the vocabulary, an example photo for each tag, and the
// signed-in reader's progress against it.
export function useTagDirectory(): {
  entries: TagDirectoryEntry[];
  isLoading: boolean;
  /** False while ownership is unknown, so an owned tag never renders as 0. */
  isProgressKnown: boolean;
  isLoggedIn: boolean;
} {
  const { tags, isLoading: isLoadingTags } = useTagVocabulary();
  const { assignments } = useTagAssignments();
  const { ownedKeys, isLoading: isLoadingOwned, isLoggedIn } = useOwnedKeys();
  const { isDeleted, isLoaded: overridesLoaded } = useBobbleheadOverrides();
  const [exampleByTag, setExampleByTag] = useState<Record<string, BobbleheadIdentity>>({});

  useEffect(() => {
    if (!assignments || assignments.length === 0) return;

    let cancelled = false;

    (async () => {
      const examples = Object.entries(chooseTagExamples(assignments, rankAsExample));
      const resolve = await buildBobbleheadResolver(supabase, [
        ...new Set(examples.map(([, assignment]) => assignment.teamSlug)),
      ]);

      if (cancelled) return;

      setExampleByTag(
        Object.fromEntries(
          examples.map(([tagSlug, assignment]) => [
            tagSlug,
            resolve(assignment.teamSlug, assignment.bobbleheadId),
          ]),
        ),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [assignments]);

  const ownedCountByTag = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const assignment of assignments ?? []) {
      if (isDeleted(assignment.teamSlug, assignment.bobbleheadId)) continue;
      if (!ownedKeys.has(listingKey(assignment.teamSlug, assignment.bobbleheadId))) continue;
      counts[assignment.tagSlug] = (counts[assignment.tagSlug] ?? 0) + 1;
    }
    return counts;
  }, [assignments, ownedKeys, isDeleted]);

  // The tag_counts view counts assignment rows, and deleting a listing doesn't
  // clear its tags — so the directory advertised totals the tag page itself
  // can't show. Recounted here off the assignments, which are loaded anyway,
  // rather than in SQL: the view is shared with the admin tools, and this is
  // the number a reader is promised on the way in. Falls back to the view's
  // count until the overrides land, so no tag flashes a wrong total on the way.
  const listingCountByTag = useMemo(() => {
    if (!assignments || !overridesLoaded) return null;

    const counts: Record<string, number> = {};
    for (const assignment of assignments) {
      if (isDeleted(assignment.teamSlug, assignment.bobbleheadId)) continue;
      counts[assignment.tagSlug] = (counts[assignment.tagSlug] ?? 0) + 1;
    }
    return counts;
  }, [assignments, overridesLoaded, isDeleted]);

  const entries = useMemo(
    () =>
      tags.map((tag) => ({
        ...tag,
        listingCount: listingCountByTag ? (listingCountByTag[tag.slug] ?? 0) : tag.listingCount,
        example: exampleByTag[tag.slug] ?? null,
        ownedCount: ownedCountByTag[tag.slug] ?? 0,
      })),
    [tags, exampleByTag, ownedCountByTag, listingCountByTag],
  );

  return {
    entries,
    isLoading: isLoadingTags || assignments === null,
    isProgressKnown: isLoggedIn && !isLoadingOwned && assignments !== null,
    isLoggedIn,
  };
}

// Everything carrying one tag, resolved to something renderable. Reuses the
// same resolver the profile and admin collection pages use, so a tagged
// listing shows the title and photo it shows everywhere else — including the
// admin-approved photo that overrides the seed one.
export function useTaggedListings(tagSlug: string): {
  listings: BobbleheadIdentity[];
  isLoading: boolean;
} {
  const [listings, setListings] = useState<BobbleheadIdentity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Paged like the directory's read, so the checklist a tag page shows is
      // the whole tag and not the first thousand of it.
      const data = await fetchAllPages((from, to) =>
        supabase
          .from("bobblehead_tags")
          .select("bobblehead_id, team_slug")
          .eq("tag_slug", tagSlug)
          .order("bobblehead_id")
          .order("team_slug")
          .range(from, to),
      );

      if (cancelled) return;

      if (!data) {
        console.error("Failed to load the tagged bobbleheads.");
        setListings([]);
        setIsLoading(false);
        return;
      }

      const rows = data;
      if (rows.length === 0) {
        setListings([]);
        setIsLoading(false);
        return;
      }

      const resolve = await buildBobbleheadResolver(supabase, [
        ...new Set(rows.map((row) => row.team_slug)),
      ]);

      if (cancelled) return;

      setListings(
        rows
          .map((row) => resolve(row.team_slug, row.bobblehead_id))
          // A tag row outlives the listing it points at: deleting a listing
          // doesn't clear its tags, so without this the checklist counts
          // bobbleheads whose page 404s towards a total you can't reach.
          .filter((listing) => !listing.deleted)
          .sort((a, b) => a.title.localeCompare(b.title)),
      );
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [tagSlug]);

  return { listings, isLoading };
}

// One listing's tags, with the add/remove the admin needs. Writes are
// authorized by RLS (is_admin — see supabase/tag_requests.sql, which took this
// away from reps), so a failure here surfaces as a toast rather than being
// second-guessed in the client. A rep's path is useMyTagRequests below.
export function useBobbleheadTags(teamSlug: string, bobbleheadId: string) {
  const { user } = useAuth();
  const { showError } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("bobblehead_tags")
      .select("tag_slug, tags(label)")
      .eq("bobblehead_id", bobbleheadId)
      .eq("team_slug", teamSlug)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load this bobblehead's tags:", error.message);
          setTags([]);
        } else {
          const rows = (data ?? []) as unknown as Array<{
            tag_slug: string;
            tags: { label: string } | null;
          }>;
          setTags(
            sortTags(
              rows.map((row) => ({ slug: row.tag_slug, label: row.tags?.label ?? row.tag_slug })),
            ),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamSlug, bobbleheadId]);

  // Takes a label rather than a slug: adding a tag and minting one are the same
  // gesture from the picker, and which of the two happened depends on whether
  // the vocabulary already has it.
  const addTag = useCallback(
    async (label: string): Promise<boolean> => {
      if (!user) return false;

      const validated = validateTagLabel(label);
      if ("error" in validated) {
        showError(validated.error);
        return false;
      }

      if (tags.some((tag) => tag.slug === validated.slug)) return true;

      // Upsert with ignoreDuplicates, so applying a tag another team already
      // minted keeps their label rather than quietly overwriting it with this
      // one's casing.
      const { error: vocabularyError } = await supabase
        .from("tags")
        .upsert({ slug: validated.slug, label: validated.label, created_by: user.id }, {
          onConflict: "slug",
          ignoreDuplicates: true,
        });

      if (vocabularyError) {
        console.error("Failed to create the tag:", vocabularyError.message);
        showError("Couldn't create that tag. Please try again.");
        return false;
      }

      const previous = tags;
      setTags(sortTags([...tags, { slug: validated.slug, label: validated.label }]));

      const { error } = await supabase.from("bobblehead_tags").insert({
        bobblehead_id: bobbleheadId,
        team_slug: teamSlug,
        tag_slug: validated.slug,
        created_by: user.id,
      });

      if (error) {
        console.error("Failed to add the tag:", error.message);
        setTags(previous);
        showError("Couldn't add that tag. Please try again.");
        return false;
      }

      return true;
    },
    [user, tags, teamSlug, bobbleheadId, showError],
  );

  const removeTag = useCallback(
    async (slug: string): Promise<boolean> => {
      if (!user) return false;

      const previous = tags;
      setTags(tags.filter((tag) => tag.slug !== slug));

      // Scoped to the team as well as the id, because the two together are
      // what name a listing — 36 bobblehead ids are shared between teams, so
      // an unscoped delete would take "Sesame Street" off all five Elmos.
      const { error } = await supabase
        .from("bobblehead_tags")
        .delete()
        .eq("bobblehead_id", bobbleheadId)
        .eq("team_slug", teamSlug)
        .eq("tag_slug", slug);

      if (error) {
        console.error("Failed to remove the tag:", error.message);
        setTags(previous);
        showError("Couldn't remove that tag. Please try again.");
        return false;
      }

      return true;
    },
    [user, tags, teamSlug, bobbleheadId, showError],
  );

  const slugs = useMemo(() => new Set(tags.map((tag) => tag.slug)), [tags]);

  return { tags, slugs, isLoading, addTag, removeTag };
}

// A rep's side of the admin-curated vocabulary: the requests they have pending
// on this listing, and the way to file another. Reads only this user's rows —
// RLS would enforce that anyway, but asking precisely keeps a busy queue from
// leaking into every listing page's payload.
export function useMyTagRequests(
  teamSlug: string,
  bobbleheadId: string,
  source: TagRequestSource,
) {
  const { user } = useAuth();
  const { showError } = useToast();
  // Stale rows after a sign-out are handled at the return, not by a reset
  // effect: a signed-out visitor has no pending requests by definition.
  const [pending, setPending] = useState<Tag[]>([]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    supabase
      .from("tag_requests")
      .select("slug, label")
      .eq("bobblehead_id", bobbleheadId)
      .eq("team_slug", teamSlug)
      .eq("requested_by", user.id)
      .eq("status", "pending")
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          // The chips are a courtesy; the listing page shouldn't break over
          // them. A rep who can't see their pending asks can still file one.
          console.error("Failed to load your tag requests:", error.message);
          setPending([]);
        } else {
          setPending(sortTags((data ?? []).map((row) => ({ slug: row.slug, label: row.label }))));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, teamSlug, bobbleheadId]);

  const requestTag = useCallback(
    async (label: string): Promise<boolean> => {
      if (!user) return false;

      const result = await submitTagRequest(supabase, {
        label,
        bobbleheadId,
        teamSlug,
        source,
        requestedBy: user.id,
      });

      if (result.error) {
        showError(result.error);
        return false;
      }

      setPending((current) =>
        current.some((tag) => tag.slug === result.slug)
          ? current
          : sortTags([...current, { slug: result.slug!, label: result.label! }]),
      );
      return true;
    },
    [user, teamSlug, bobbleheadId, source, showError],
  );

  return { pending: user ? pending : [], requestTag };
}
