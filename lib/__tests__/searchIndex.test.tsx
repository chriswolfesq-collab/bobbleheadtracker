// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BobbleheadOverride } from "@/lib/bobbleheadOverrides";
import type { SearchResult } from "@/lib/search";
import { useSearchIndex } from "@/lib/useSearchIndex";

// A curated listing's photo lives in build-time data, so an admin who removes
// one can't delete it — they flag the override instead, and every surface that
// reads the seed has to honour the flag. The team page and the calendar feed do
// (lib/teamListings.ts, lib/giveawayFeed.ts); search read the seed straight off
// the index, so 155 photos an admin had taken down were still being served in
// results while the listing pages showed the replacement.

const SEEDED: SearchResult = {
  id: "helton-2019",
  title: "Todd Helton",
  nickname: null,
  date: "2019-04-05",
  year: "2019",
  imageUrl: "/bobbleheads/rockies-photos/helton-2019.jpg",
  teamSlug: "rockies",
  teamName: "Rockies",
  teamCity: "Colorado",
  href: "/teams/rockies/bobbleheads/helton-2019",
  source: "curated",
};

function override(values: Partial<BobbleheadOverride> = {}): BobbleheadOverride {
  return {
    title: null,
    nickname: null,
    quantity: null,
    year: null,
    date: null,
    city: null,
    rarity: null,
    rarityNote: null,
    description: null,
    deleted: false,
    photoHidden: false,
    ...values,
  };
}

const overrides: Record<string, BobbleheadOverride> = {};

vi.mock("@/lib/search", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/search")>()),
  get CURATED_SEARCH_INDEX() {
    return [SEEDED];
  },
}));
vi.mock("@/lib/communityBobbleheads", () => ({
  useAllCommunityBobbleheads: () => ({ communityBobbleheads: [], isLoading: false }),
}));
vi.mock("@/lib/useTags", () => ({
  useAllBobbleheadTags: () => ({ tagsByKey: {}, isLoading: false }),
}));
vi.mock("@/lib/bobbleheadOverrides", () => ({
  useBobbleheadOverrides: () => ({
    isDeleted: (teamSlug: string, id: string) =>
      Boolean(overrides[`${teamSlug}/${id}`]?.deleted),
    getOverride: (teamSlug: string, id: string) => overrides[`${teamSlug}/${id}`] ?? null,
    isLoaded: true,
  }),
}));

function indexWith(override: BobbleheadOverride | null): SearchResult[] {
  for (const key of Object.keys(overrides)) delete overrides[key];
  if (override) overrides["rockies/helton-2019"] = override;
  return renderHook(() => useSearchIndex()).result.current;
}

describe("useSearchIndex", () => {
  it("keeps the seed photo when nothing has been overridden", () => {
    expect(indexWith(null)[0].imageUrl).toBe(SEEDED.imageUrl);
  });

  it("keeps the seed photo through an unrelated edit", () => {
    // An override row exists for the retitle alone — it must not be read as a
    // photo removal.
    expect(indexWith(override({ title: "Renamed" }))[0].imageUrl).toBe(SEEDED.imageUrl);
  });

  it("drops a seed photo the admin has hidden", () => {
    // Null, not the seed: a result that keeps the URL shows a photo that has
    // been taken down, and nothing downstream can tell it from a live one.
    expect(indexWith(override({ photoHidden: true }))[0].imageUrl).toBeNull();
  });
});
