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
  rarity: null,
  rarityNote: null,
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
    galleryPhotos: {},
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

  // The bug the Cubs rep hit on 2026-08-02: 25 of his listings had a photo on
  // their detail page (borrowed from the gallery) and a placeholder in the grid,
  // because only the grid stopped looking after the main photo.
  it("falls back to the first gallery photo when a listing has no photo of its own", () => {
    const gallery = { "rockies/helton-2019": "https://gallery", "rockies/community-1": "https://community-gallery" };

    const [curatedListing] = merge({
      curated: [curated({ imageUrl: null })],
      galleryPhotos: gallery,
    });
    const [, communityListing] = merge({
      community: [community()],
      galleryPhotos: gallery,
    });

    expect(curatedListing.imageUrl).toBe("https://gallery");
    expect(communityListing.imageUrl).toBe("https://community-gallery");
  });

  it("keeps the gallery below the main photo and the seed", () => {
    const galleryPhotos = { "rockies/helton-2019": "https://gallery" };

    const [seeded] = merge({ galleryPhotos });
    const [approved] = merge({
      photos: { "rockies/helton-2019": "https://approved" },
      galleryPhotos,
    });

    expect(seeded.imageUrl).toBe("https://seed-photo");
    expect(approved.imageUrl).toBe("https://approved");
  });

  // Hiding the seed photo says "not this one", not "no photo at all" — the same
  // reading the detail page takes.
  it("drops through to the gallery when an admin hides the seed photo", () => {
    const [listing] = merge({
      overrides: { "rockies/helton-2019": override({ photoHidden: true }) },
      galleryPhotos: { "rockies/helton-2019": "https://gallery" },
    });

    expect(listing.imageUrl).toBe("https://gallery");
  });

  // The Athletics are the only team with a city, and it comes from the year
  // unless someone has picked one. Community rows carry their own pick.
  it("resolves the Athletics city, and leaves every other team without one", () => {
    const [oakland] = mergeTeamListings({
      teamSlug: "athletics",
      curated: [curated({ year: "2019" })],
      overrides: {},
      photos: {},
      galleryPhotos: {},
      community: [],
    });
    const [, sacramento] = mergeTeamListings({
      teamSlug: "athletics",
      curated: [curated({ year: "2019" })],
      overrides: {},
      photos: {},
      galleryPhotos: {},
      community: [community({ teamSlug: "athletics", year: "2026" })],
    });

    expect(oakland.city).toBe("Oakland");
    expect(sacramento.city).toBe("Sacramento");
    expect(merge()[0].city).toBeNull();
  });
});
