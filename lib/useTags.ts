"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { type BobbleheadIdentity, buildBobbleheadResolver } from "@/lib/bobbleheadIdentity";
import { supabase } from "@/lib/supabase";
import { sortTags, type Tag, type TagWithCount, validateTagLabel } from "@/lib/tags";

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

// Every assignment in one query, joined to its label. Feeds the search index,
// which has to be able to match a tag on any listing without knowing in advance
// which listings the user will type towards.
//
// The whole table, deliberately: it's one row per (listing, tag), it's public,
// and paging it would mean search silently not matching whatever fell off the
// end. If it ever outgrows that, the fix is a server-side search, not a limit.
export function useAllBobbleheadTags(): { tagsByKey: TagsByKey; isLoading: boolean } {
  const [tagsByKey, setTagsByKey] = useState<TagsByKey>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("bobblehead_tags")
      .select("bobblehead_id, team_slug, tag_slug, tags(label)")
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          // Search and the listing pages both degrade to "no tags" rather than
          // breaking, which is why this doesn't toast: nobody asked for tags,
          // they asked for a search box.
          console.error("Failed to load tags:", error.message);
          setTagsByKey({});
        } else {
          const map: TagsByKey = {};
          for (const row of (data ?? []) as unknown as AssignmentRow[]) {
            const key = `${row.team_slug}:${row.bobblehead_id}`;
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
      });

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
      const { data, error } = await supabase
        .from("bobblehead_tags")
        .select("bobblehead_id, team_slug")
        .eq("tag_slug", tagSlug);

      if (cancelled) return;

      if (error) {
        console.error("Failed to load the tagged bobbleheads:", error.message);
        setListings([]);
        setIsLoading(false);
        return;
      }

      const rows = data ?? [];
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

// One listing's tags, with the add/remove an admin or team rep needs. Writes
// are authorized by RLS (can_edit_team), so a failure here surfaces as a toast
// rather than being second-guessed in the client.
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
