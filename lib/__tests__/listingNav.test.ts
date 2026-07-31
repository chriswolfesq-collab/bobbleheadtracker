import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import { sortNewestFirst } from "@/lib/releaseOrder";

// The two DB-backed reads the nav builder merges, stubbed so the test runs
// against the real curated JSON without a Supabase connection.
vi.mock("@/lib/communityServer", () => ({
  getCommunityListings: vi.fn(),
  getCommunityListing: vi.fn(),
}));
vi.mock("@/lib/curatedListing", () => ({ getDeletedListingKeys: vi.fn() }));

const { getCommunityListings, getCommunityListing } = await import("@/lib/communityServer");
const { getDeletedListingKeys } = await import("@/lib/curatedListing");
const { buildListingNav } = await import("@/lib/listingNav");

const CURATED = sortNewestFirst(getGiveawaysByTeamSlug("rockies"));
const NEWEST = CURATED[0];
const SECOND = CURATED[1];

// Dated a decade past anything in the catalog so it sorts to the front, where
// the newest community submission on a real team page sits.
const COMMUNITY = {
  id: "test-community-listing",
  teamSlug: "rockies",
  title: "Test Community Bobblehead",
  nickname: null,
  quantity: null,
  year: "2099",
  date: "July 4, 2099",
  imageUrl: null,
};

beforeEach(() => {
  // Call counts matter below ("don't spend a read"), so start each test clean.
  vi.clearAllMocks();
  vi.mocked(getCommunityListings).mockResolvedValue([
    COMMUNITY,
    // A listing on another team must not leak into this team's chain.
    { ...COMMUNITY, id: "other-team-listing", teamSlug: "dodgers" },
  ]);
  vi.mocked(getDeletedListingKeys).mockResolvedValue(new Set<string>());
  vi.mocked(getCommunityListing).mockResolvedValue(null);
});

describe("buildListingNav", () => {
  it("counts community listings in the total, matching the team header", async () => {
    // The header count is curated - deleted + community (getTeamListingCount).
    // The counter used to report the curated count alone, so the two disagreed
    // by exactly the team's community count and the tail was unreachable.
    const nav = await buildListingNav("rockies", NEWEST.id);
    expect(nav.total).toBe(CURATED.length + 1);
  });

  it("puts a community listing in the chain with its own route", async () => {
    const nav = await buildListingNav("rockies", NEWEST.id);
    expect(nav.position).toBe(2);
    expect(nav.prev).toEqual({
      id: COMMUNITY.id,
      title: COMMUNITY.title,
      href: `/teams/rockies/community/${COMMUNITY.id}`,
    });
    expect(nav.next?.href).toBe(`/teams/rockies/bobbleheads/${SECOND.id}`);
  });

  it("gives a community listing its own prev/next instead of a dead end", async () => {
    const nav = await buildListingNav("rockies", COMMUNITY.id);
    expect(nav.position).toBe(1);
    // First in the order, so no prev — the boundary behavior curated pages have.
    expect(nav.prev).toBeNull();
    expect(nav.next?.href).toBe(`/teams/rockies/bobbleheads/${NEWEST.id}`);
  });

  it("skips admin-deleted curated listings", async () => {
    vi.mocked(getDeletedListingKeys).mockResolvedValue(new Set([`rockies/${NEWEST.id}`]));
    const nav = await buildListingNav("rockies", COMMUNITY.id);
    expect(nav.total).toBe(CURATED.length);
    expect(nav.next?.href).toBe(`/teams/rockies/bobbleheads/${SECOND.id}`);
  });

  it("stops at the end of the chain rather than wrapping", async () => {
    const oldest = CURATED[CURATED.length - 1];
    const nav = await buildListingNav("rockies", oldest.id);
    expect(nav.position).toBe(CURATED.length + 1);
    expect(nav.next).toBeNull();
    expect(nav.prev).not.toBeNull();
  });

  // A listing approved minutes ago is served from a direct DB read while the
  // cached snapshot still predates it. It used to fall out of its own chain —
  // no arrows, total one short — and ISR then pinned that page for an hour.
  describe("a listing the cached snapshot hasn't caught up with", () => {
    // A day newer than the snapshot's listing, so it sorts to the very front
    // where a just-approved submission lands on the team page.
    const FRESH = {
      ...COMMUNITY,
      id: "just-approved",
      title: "Just Approved",
      date: "July 5, 2099",
    };

    beforeEach(() => {
      // The snapshot holds the older community listing but not the new one.
      vi.mocked(getCommunityListing).mockResolvedValue(FRESH);
    });

    it("places itself in the chain from the row the page already read", async () => {
      const nav = await buildListingNav("rockies", FRESH.id, FRESH);
      expect(nav.position).toBe(1);
      expect(nav.next?.href).toBe(`/teams/rockies/community/${COMMUNITY.id}`);
      expect(nav.total).toBe(CURATED.length + 2);
      expect(getCommunityListing).not.toHaveBeenCalled();
    });

    it("falls back to a direct read when the row wasn't handed over", async () => {
      const nav = await buildListingNav("rockies", FRESH.id);
      expect(getCommunityListing).toHaveBeenCalledWith("rockies", FRESH.id);
      expect(nav.position).toBe(1);
      expect(nav.next).not.toBeNull();
    });

    it("doesn't spend a read on a curated id, which 404s instead", async () => {
      vi.mocked(getDeletedListingKeys).mockResolvedValue(new Set([`rockies/${NEWEST.id}`]));
      await buildListingNav("rockies", NEWEST.id);
      expect(getCommunityListing).not.toHaveBeenCalled();
    });
  });

  it("leaves other teams' community listings out", async () => {
    const nav = await buildListingNav("rockies", NEWEST.id);
    expect(nav.related.some((entry) => entry.id === "other-team-listing")).toBe(false);
  });
});
