import { describe, expect, it } from "vitest";
import { getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import type { BobbleheadOverride } from "@/lib/bobbleheadOverrides";
import type { CommunityListingRow } from "@/lib/communityServer";
import { scheduleEntries } from "@/lib/giveawayFeed";

// scheduleEntries is the pure half of the feed — it takes the three sources
// rather than reading them — so this runs against the real curated JSON with
// no Supabase connection.

const CURATED = getGiveawaysByTeamSlug("rockies");
const FIRST = CURATED[0];

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
  title: "Todd Helton",
  nickname: null,
  quantity: null,
  year: "2026",
  date: "September 12, 2026",
  imageUrl: null,
  ...over,
});

const sources = (over: Partial<Parameters<typeof scheduleEntries>[0]> = {}) => ({
  overrides: {},
  photos: {},
  community: [],
  teamSlug: "rockies",
  ...over,
});

describe("scheduleEntries", () => {
  it("reads the curated catalog for the team", () => {
    const entries = scheduleEntries(sources());

    expect(entries).toHaveLength(CURATED.length);
    expect(entries.every((entry) => entry.isCurated)).toBe(true);
  });

  // The catalog ships with the build, so a date announced since then only
  // exists as an admin edit. Reading the catalog alone kept every newly
  // scheduled giveaway off the strip.
  it("takes an admin's corrected date over the catalog's", () => {
    const entries = scheduleEntries(
      sources({
        overrides: {
          [`rockies/${FIRST.id}`]: override({ date: "July 4, 2027", title: "Renamed" }),
        },
      }),
    );

    const entry = entries.find((row) => row.id === FIRST.id);
    expect(entry?.date).toBe("July 4, 2027");
    expect(entry?.title).toBe("Renamed");
  });

  it("leaves out a listing an admin deleted", () => {
    const entries = scheduleEntries(
      sources({ overrides: { [`rockies/${FIRST.id}`]: override({ deleted: true }) } }),
    );

    expect(entries.some((row) => row.id === FIRST.id)).toBe(false);
  });

  // The other half of what was missing: a listing a user added is a real row,
  // never in the catalog at all.
  it("includes community listings, marked as not curated", () => {
    const entries = scheduleEntries(sources({ community: [community()] }));
    const entry = entries.find((row) => row.id === "community-1");

    expect(entry?.title).toBe("Todd Helton");
    expect(entry?.isCurated).toBe(false);
  });

  it("keeps another team's listings out of a single-team feed", () => {
    const entries = scheduleEntries(
      sources({ community: [community({ id: "elsewhere", teamSlug: "brewers" })] }),
    );

    expect(entries.some((row) => row.teamSlug !== "rockies")).toBe(false);
  });

  it("covers every team when no slug is given", () => {
    const entries = scheduleEntries(sources({ teamSlug: undefined }));

    expect(new Set(entries.map((row) => row.teamSlug)).size).toBe(30);
  });

  it("shows the approved photo, and nothing where a seed photo was removed", () => {
    const [approved, hidden] = [
      scheduleEntries(sources({ photos: { [`rockies/${FIRST.id}`]: "https://photo" } })),
      scheduleEntries(
        sources({ overrides: { [`rockies/${FIRST.id}`]: override({ photoHidden: true }) } }),
      ),
    ];

    expect(approved.find((row) => row.id === FIRST.id)?.imageUrl).toBe("https://photo");
    expect(hidden.find((row) => row.id === FIRST.id)?.imageUrl).toBeNull();
  });
});
