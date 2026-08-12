// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { ListingNav, ListingNavEntry } from "@/lib/listingNav";
import { listingNavFromTrail, saveListingTrail } from "@/lib/listingTrail";

function entry(id: string): ListingNavEntry {
  return { id, title: id, href: `/teams/rockies/community/${id}` };
}

const TRAIL = { label: "Recently Added", entries: [entry("a"), entry("b"), entry("c")] };

// What the server hands the page: this team's chain, in release order.
const TEAM_CHAIN: ListingNav = {
  position: 1,
  total: 104,
  prev: null,
  next: entry("z"),
  related: [entry("y")],
};

describe("listingNavFromTrail", () => {
  it("walks the trail rather than the team chain", () => {
    const nav = listingNavFromTrail(TRAIL, "/teams/rockies/community/b", TEAM_CHAIN);

    expect(nav).toMatchObject({
      position: 2,
      total: 3,
      prev: entry("a"),
      next: entry("c"),
      source: "Recently Added",
    });
  });

  // The regression this module exists for: the first card on Recently Added is
  // usually its team's newest listing, so the team chain put it at position 1
  // with no prev — a missing back arrow on a list the reader had 200 more of.
  it("gives the trail's first entry a back arrow when the team chain would not", () => {
    expect(listingNavFromTrail(TRAIL, "/teams/rockies/community/b", TEAM_CHAIN)?.prev).toEqual(
      entry("a"),
    );
    expect(TEAM_CHAIN.prev).toBeNull();
  });

  it("keeps the ends of the trail closed", () => {
    expect(listingNavFromTrail(TRAIL, "/teams/rockies/community/a", TEAM_CHAIN)?.prev).toBeNull();
    expect(listingNavFromTrail(TRAIL, "/teams/rockies/community/c", TEAM_CHAIN)?.next).toBeNull();
  });

  // "related" is the crawlable more-from-this-team block, which a trail has no
  // business rewriting.
  it("leaves the server chain's related links alone", () => {
    const nav = listingNavFromTrail(TRAIL, "/teams/rockies/community/b", TEAM_CHAIN);

    expect(nav?.related).toEqual(TEAM_CHAIN.related);
  });

  it("falls back to the team chain for a listing the trail doesn't hold", () => {
    expect(listingNavFromTrail(TRAIL, "/teams/rockies/community/elsewhere", TEAM_CHAIN)).toBeNull();
  });

  // Community ids are percent-encoded into hrefs and the browser reports the
  // encoded pathname; the two spellings have to match.
  it("matches an encoded pathname against its decoded href", () => {
    const trail = {
      label: "Search",
      entries: [entry("first"), { id: "a b", title: "A B", href: "/teams/rockies/community/a%20b" }],
    };

    expect(listingNavFromTrail(trail, "/teams/rockies/community/a b", null)?.position).toBe(2);
  });

  it("ignores a query string on the current path", () => {
    const nav = listingNavFromTrail(TRAIL, "/teams/rockies/community/b?from=tab%3Downed", null);

    expect(nav?.position).toBe(2);
  });
});

describe("saveListingTrail", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips through the hook's reader", () => {
    saveListingTrail("Recently Added", TRAIL.entries, 1);

    expect(
      listingNavFromTrail(
        JSON.parse(sessionStorage.getItem("bobbleshelf:listing-trail") ?? "null"),
        "/teams/rockies/community/b",
        null,
      ),
    ).toMatchObject({ position: 2, total: 3, source: "Recently Added" });
  });

  // A broad search matches thousands; the stored window has to stay centered on
  // the click rather than truncating from the head and stranding it.
  it("centers the stored window on the clicked entry", () => {
    const many = Array.from({ length: 5000 }, (_, index) => entry(`n${index}`));
    saveListingTrail("Search", many, 4000);

    const stored = JSON.parse(sessionStorage.getItem("bobbleshelf:listing-trail") ?? "null");
    expect(stored.entries).toHaveLength(2000);
    expect(
      listingNavFromTrail(stored, "/teams/rockies/community/n4000", null)?.position,
    ).toBe(1001);
  });

  it("clamps the window at the end of a long list", () => {
    const many = Array.from({ length: 5000 }, (_, index) => entry(`n${index}`));
    saveListingTrail("Search", many, 4999);

    const stored = JSON.parse(sessionStorage.getItem("bobbleshelf:listing-trail") ?? "null");
    expect(stored.entries).toHaveLength(2000);
    expect(listingNavFromTrail(stored, "/teams/rockies/community/n4999", null)?.next).toBeNull();
  });
});
