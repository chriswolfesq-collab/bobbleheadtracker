import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import { sortNewestFirst } from "@/lib/releaseOrder";

// The two DB-backed reads the nav builder merges, stubbed so the test runs
// against the real curated JSON without a Supabase connection.
vi.mock("@/lib/communityServer", () => ({ getCommunityListings: vi.fn() }));
vi.mock("@/lib/curatedListing", () => ({ getDeletedListingKeys: vi.fn() }));

const { getCommunityListings } = await import("@/lib/communityServer");
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
  vi.mocked(getCommunityListings).mockResolvedValue([
    COMMUNITY,
    // A listing on another team must not leak into this team's chain.
    { ...COMMUNITY, id: "other-team-listing", teamSlug: "dodgers" },
  ]);
  vi.mocked(getDeletedListingKeys).mockResolvedValue(new Set<string>());
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

  it("leaves other teams' community listings out", async () => {
    const nav = await buildListingNav("rockies", NEWEST.id);
    expect(nav.related.some((entry) => entry.id === "other-team-listing")).toBe(false);
  });
});
