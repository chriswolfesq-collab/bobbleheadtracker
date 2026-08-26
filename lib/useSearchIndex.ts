"use client";

import { useMemo } from "react";
import { useBobbleheadOverrides } from "@/lib/bobbleheadOverrides";
import { useAllCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { CURATED_SEARCH_INDEX, type SearchResult } from "@/lib/search";
import { getTeamBySlug } from "@/lib/teams";
import { useAllBobbleheadTags } from "@/lib/useTags";

// The full client-side search index: build-time curated entries (with admin
// deletions and overrides applied) plus live community listings, optionally
// scoped to one team. Shared by the SiteSearch dropdown and the /search page
// so both always search the same data.
export function useSearchIndex(teamSlug?: string): SearchResult[] {
  const { communityBobbleheads } = useAllCommunityBobbleheads();
  const { isDeleted, getOverride } = useBobbleheadOverrides();
  // Tags are stored, not bundled, so they're attached here rather than baked
  // into CURATED_SEARCH_INDEX at build time.
  const { tagsByKey } = useAllBobbleheadTags();

  return useMemo<SearchResult[]>(() => {
    const labelsFor = (slug: string, id: string): string[] | undefined =>
      tagsByKey[`${slug}:${id}`]?.map((tag) => tag.label);

    const community: SearchResult[] = communityBobbleheads.map((giveaway) => {
      const team = getTeamBySlug(giveaway.teamSlug);
      return {
        id: giveaway.id,
        title: giveaway.title,
        nickname: giveaway.nickname ?? null,
        date: giveaway.date,
        year: giveaway.year,
        imageUrl: giveaway.imageUrl,
        teamSlug: giveaway.teamSlug,
        teamName: team?.name ?? giveaway.teamSlug,
        teamCity: team?.city ?? "",
        href: `/teams/${giveaway.teamSlug}/community/${encodeURIComponent(giveaway.id)}`,
        source: "community",
        tags: labelsFor(giveaway.teamSlug, giveaway.id),
      };
    });

    // Curated entries are indexed from build-time data, so admin edits
    // (bobblehead_overrides) have to be applied here or search would keep
    // matching and showing the pre-edit title/year/date.
    const curated = CURATED_SEARCH_INDEX.filter((result) => !isDeleted(result.teamSlug, result.id)).map(
      (result) => {
        const override = getOverride(result.teamSlug, result.id);
        const tags = labelsFor(result.teamSlug, result.id);
        if (!override) return tags ? { ...result, tags } : result;
        return {
          ...result,
          title: override.title ?? result.title,
          nickname: override.nickname ?? result.nickname,
          year: override.year ?? result.year,
          date: override.date ?? result.date,
          // A removed seed photo can't be deleted out of the build-time data,
          // so it's suppressed with a flag instead — and a result that keeps
          // its imageUrl goes on showing a photo an admin took down, since
          // nothing downstream can tell it from a live one. Same suppression
          // as lib/teamListings.ts and lib/giveawayFeed.ts. Whatever replaced
          // it (an approved photo, or a gallery photo underneath) is layered
          // back on by useAllListingPhotos, which outranks this field.
          imageUrl: override.photoHidden ? null : result.imageUrl,
          tags,
        };
      },
    );
    const combined = [...curated, ...community];
    return teamSlug ? combined.filter((result) => result.teamSlug === teamSlug) : combined;
  }, [communityBobbleheads, teamSlug, isDeleted, getOverride, tagsByKey]);
}
