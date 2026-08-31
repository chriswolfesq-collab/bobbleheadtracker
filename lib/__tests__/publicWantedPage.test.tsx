// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShelfWantedPage, { generateMetadata } from "@/app/shelf/[slug]/wanted/page";
import type { PublicGalleryItem, PublicShelf } from "@/lib/publicShelf";

// The full wanted list at /shelf/<slug>/wanted. Two things matter here: it is
// the page someone forwards ("this is what I'm after"), and it must not become
// a way to find out whose list is private — a shelf that hasn't published one
// has to 404 exactly like a slug that doesn't exist.

class NotFound extends Error {}

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFound("NEXT_NOT_FOUND");
  },
  // The breadcrumb trail's back arrow is a client component that reads it.
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const getPublicShelf = vi.fn();
const getPublicGallery = vi.fn();
vi.mock("@/lib/publicShelf", () => ({
  getPublicShelf: (slug: string) => getPublicShelf(slug),
  getPublicGallery: (slug: string) => getPublicGallery(slug),
}));

function shelf(): PublicShelf {
  return {
    displayName: "Dana",
    countByTeamSlug: {},
    totalByTeamSlug: {},
    stats: {
      totalOwned: 0,
      siteTotal: 0,
      pctComplete: 0,
      teamsStarted: 0,
      teamsCompleted: 0,
      teamCount: 30,
    },
    memberNumber: null,
    repTeams: [],
    approvedSubmissions: 0,
    qualifyingReferrals: 0,
    streakMonths: 0,
  };
}

function item(kind: PublicGalleryItem["kind"], id: string): PublicGalleryItem {
  return {
    kind,
    bobbleheadId: id,
    teamSlug: "cubs",
    title: id,
    imageUrl: null,
    href: `/teams/cubs/bobbleheads/${id}`,
  };
}

const params = Promise.resolve({ slug: "dana" });

beforeEach(() => {
  getPublicShelf.mockReset();
  getPublicGallery.mockReset();
});

afterEach(cleanup);

describe("the full wanted list page", () => {
  it("shows every wanted item, uncapped — this is where the shelf sends people", async () => {
    getPublicShelf.mockResolvedValue(shelf());
    getPublicGallery.mockResolvedValue(
      Array.from({ length: 200 }, (_, i) => item("wanted", `wanted-${i}`)),
    );

    render(await ShelfWantedPage({ params }));

    const cards = screen
      .getAllByRole("link")
      .filter((el) => el.getAttribute("href")?.includes("/bobbleheads/"));
    expect(cards).toHaveLength(200);
    expect(screen.getByText(/what dana is still hunting for/i)).toBeTruthy();
    // The way back, for someone who arrived on this page from a shared link.
    expect(
      screen.getByRole("link", { name: /back to dana/i }).getAttribute("href"),
    ).toBe("/shelf/dana");
  });

  it("leaves out owned and favorited items the same gallery call returns", async () => {
    getPublicShelf.mockResolvedValue(shelf());
    getPublicGallery.mockResolvedValue([
      item("owned", "andre-dawson"),
      item("favorite", "ernie-banks"),
      item("wanted", "ryne-sandberg"),
    ]);

    render(await ShelfWantedPage({ params }));

    expect(screen.getByText("ryne-sandberg")).toBeTruthy();
    expect(screen.queryByText("andre-dawson")).toBeNull();
    expect(screen.queryByText("ernie-banks")).toBeNull();
  });

  it("404s when the shelf publishes no wanted list, like an unknown slug does", async () => {
    getPublicShelf.mockResolvedValue(shelf());
    getPublicGallery.mockResolvedValue([item("owned", "andre-dawson")]);

    await expect(ShelfWantedPage({ params })).rejects.toBeInstanceOf(NotFound);
  });

  it("404s on an unknown or private shelf without asking a second question", async () => {
    getPublicShelf.mockResolvedValue(null);
    getPublicGallery.mockResolvedValue([]);

    await expect(ShelfWantedPage({ params })).rejects.toBeInstanceOf(NotFound);
  });

  it("titles the link preview with the count, and says nothing when there's no page", async () => {
    getPublicShelf.mockResolvedValue(shelf());
    getPublicGallery.mockResolvedValue([
      item("wanted", "ryne-sandberg"),
      item("wanted", "ron-santo"),
    ]);
    expect((await generateMetadata({ params })).title).toBe("2 bobbleheads Dana is still after");

    getPublicShelf.mockResolvedValue(null);
    expect((await generateMetadata({ params })).title).toBe("Wanted list not found");
  });
});
