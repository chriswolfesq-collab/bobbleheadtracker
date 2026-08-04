import { describe, expect, it } from "vitest";
import type { Giveaway } from "@/lib/bobbleheads";
import type { BobbleheadOverride } from "@/lib/bobbleheadOverrides";
import type { CommunityListingRow } from "@/lib/communityServer";
import { mergeTeamListings } from "@/lib/teamListings";

// The merge the team page ships as HTML. Pure — it takes the three sources
// rather than reading them — so this needs no Supabase connection.

const curated = (over: Partial<Giveaway> = {}): Giveaway => ({
  id: "helton-2019",
  title: "Todd Helton",
  year: "2019",
  date: "June 1, 2019",
  imageUrl: "https://seed-photo",
  ...over,
});

const override = (over: Partial<BobbleheadOverride> = {}): BobbleheadOverride => ({
  title: null,
  nickname: null,
  quantity: null,
  year: null,
  date: null,
  city: null,
  deleted: false,
  photoHidden: false,
  ...over,
});

const community = (over: Partial<CommunityListingRow> = {}): CommunityListingRow => ({
  id: "community-1",
  teamSlug: "rockies",
  title: "Nolan Arenado",
  nickname: null,
  quantity: null,
  year: "2021",
  date: "July 4, 2021",
  imageUrl: null,
  ...over,
});

const merge = (over: Partial<Parameters<typeof mergeTeamListings>[0]> = {}) =>
  mergeTeamListings({
    teamSlug: "rockies",
    curated: [curated()],
    overrides: {},
    photos: {},
    community: [],
    ...over,
  });

describe("mergeTeamListings", () => {
  it("marks where each listing came from", () => {
    const listings = merge({ community: [community()] });

    expect(listings.map((listing) => [listing.title, listing.source])).toEqual([
      ["Todd Helton", "curated"],
      ["Nolan Arenado", "community"],
    ]);
  });

  it("applies an admin's edits to a curated listing", () => {
    const [listing] = merge({
      overrides: {
        "rockies/helton-2019": override({ title: "Todd Helton (Hall of Fame)", date: "June 8, 2019" }),
      },
    });

    expect(listing.title).toBe("Todd Helton (Hall of Fame)");
    expect(listing.date).toBe("June 8, 2019");
  });

  it("drops a listing an admin deleted", () => {
    expect(merge({ overrides: { "rockies/helton-2019": override({ deleted: true }) } })).toEqual([]);
  });

  it("keeps another team's community listings out", () => {
    const listings = merge({ community: [community({ teamSlug: "brewers" })] });

    expect(listings.map((listing) => listing.source)).toEqual(["curated"]);
  });

  it("prefers an approved photo, and drops a seed photo an admin hid", () => {
    const [approved] = merge({ photos: { "rockies/helton-2019": "https://approved" } });
    const [hidden] = merge({
      overrides: { "rockies/helton-2019": override({ photoHidden: true }) },
    });

    expect(approved.imageUrl).toBe("https://approved");
    expect(hidden.imageUrl).toBeNull();
  });

  // The Athletics are the only team with a city, and it comes from the year
  // unless someone has picked one. Community rows carry their own pick.
  it("resolves the Athletics city, and leaves every other team without one", () => {
    const [oakland] = mergeTeamListings({
      teamSlug: "athletics",
      curated: [curated({ year: "2019" })],
      overrides: {},
      photos: {},
      community: [],
    });
    const [, sacramento] = mergeTeamListings({
      teamSlug: "athletics",
      curated: [curated({ year: "2019" })],
      overrides: {},
      photos: {},
      community: [community({ teamSlug: "athletics", year: "2026" })],
    });

    expect(oakland.city).toBe("Oakland");
    expect(sacramento.city).toBe("Sacramento");
    expect(merge()[0].city).toBeNull();
  });
});
