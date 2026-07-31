// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TagPageClient } from "@/app/tags/[slug]/TagPageClient";
import { TagsPageClient } from "@/app/tags/TagsPageClient";
import type { BobbleheadIdentity } from "@/lib/bobbleheadIdentity";
import type { TagDirectoryEntry } from "@/lib/useTags";

// A tag as a checklist: how many of it you own, and checking one off from the
// tag page rather than going team by team. The signed-in half of the page can't
// be reached without an account, so the collection and the listings are stubbed
// and what's exercised is what the page does with them.

const setOwned = vi.fn();

let ownedKeys = new Set<string>();
let isLoggedIn = true;
let isLoadingOwned = false;

const listing = (teamSlug: string, bobbleheadId: string, title: string): BobbleheadIdentity => ({
  teamSlug,
  bobbleheadId,
  title,
  imageUrl: null,
  href: `/teams/${teamSlug}/bobbleheads/${bobbleheadId}`,
});

const LISTINGS = [
  listing("dodgers", "grogu-2023", "Grogu"),
  listing("nationals", "vader-2019", "Darth Vader"),
  listing("rays", "han-longo-2015", "Han Longo"),
  listing("astros", "jedi-altuve-2018", "Jedi Altuve"),
];

// The trail's back button reaches for the router, which needs an app-router
// context this render has no use for.
vi.mock("@/components/Breadcrumbs", () => ({ Breadcrumbs: () => null }));

const directoryEntry = (
  label: string,
  ownedCount: number,
  listingCount: number,
): TagDirectoryEntry => ({
  slug: label.toLowerCase().replace(/\s+/g, "-"),
  label,
  listingCount,
  ownedCount,
  example: null,
});

let directory: TagDirectoryEntry[] = [];

vi.mock("@/lib/useTags", () => ({
  useTaggedListings: () => ({ listings: LISTINGS, isLoading: false }),
  useTagVocabulary: () => ({
    tags: [{ slug: "star-wars", label: "Star Wars", listingCount: LISTINGS.length }],
    isLoading: false,
  }),
  useTagDirectory: () => ({
    entries: directory,
    isLoading: false,
    isProgressKnown: isLoggedIn && !isLoadingOwned,
    isLoggedIn,
  }),
}));

vi.mock("@/lib/profile", () => ({
  useOwnedKeys: () => ({
    ownedKeys,
    isLoading: isLoadingOwned,
    isLoggedIn,
    setOwned,
  }),
}));

beforeEach(() => {
  setOwned.mockReset();
  ownedKeys = new Set(["dodgers:grogu-2023"]);
  isLoggedIn = true;
  isLoadingOwned = false;
  // Deliberately neither alphabetical nor already in progress order.
  directory = [
    directoryEntry("Peanuts", 1, 10),
    directoryEntry("Star Wars", 9, 10),
    directoryEntry("Sugar Skull", 0, 4),
    directoryEntry("Bobblehead Night", 5, 10),
  ];
});

afterEach(cleanup);

describe("the tag page as a checklist", () => {
  it("counts what you own against the tag", () => {
    render(<TagPageClient slug="star-wars" />);

    expect(screen.getByText("1 of 4 collected")).toBeDefined();
    expect(screen.getByText(/3 to go/)).toBeDefined();
  });

  it("says so when the tag is complete", () => {
    ownedKeys = new Set(LISTINGS.map((item) => `${item.teamSlug}:${item.bobbleheadId}`));
    render(<TagPageClient slug="star-wars" />);

    expect(screen.getByText("4 of 4 collected")).toBeDefined();
    expect(screen.getByText(/every one of them/)).toBeDefined();
  });

  // The two halves of the key both matter: elmo-2023 belongs to five teams, and
  // owning one team's is not owning the rest.
  it("doesn't credit you for another team's listing with the same id", () => {
    ownedKeys = new Set(["angels:grogu-2023"]);
    render(<TagPageClient slug="star-wars" />);

    expect(screen.getByText("0 of 4 collected")).toBeDefined();
  });

  it("checks one off against the team it belongs to", () => {
    render(<TagPageClient slug="star-wars" />);

    fireEvent.click(screen.getByRole("button", { name: /Mark Darth Vader as owned/ }));

    expect(setOwned).toHaveBeenCalledWith("nationals", "vader-2019", true);
  });

  it("unchecks one you already have", () => {
    render(<TagPageClient slug="star-wars" />);

    fireEvent.click(screen.getByRole("button", { name: /Mark Grogu as not owned/ }));

    expect(setOwned).toHaveBeenCalledWith("dodgers", "grogu-2023", false);
  });

  // An owned collection flashing as an empty one, and a click landing on a
  // checkbox whose state isn't known yet, are the same bug.
  it("holds off on both the count and the checkboxes until the collection lands", () => {
    isLoadingOwned = true;
    render(<TagPageClient slug="star-wars" />);

    expect(screen.getByText("4 in this tag")).toBeDefined();
    expect(screen.getByRole("button", { name: /Grogu/ }).hasAttribute("disabled")).toBe(true);
  });

  it("invites a signed-out reader to log in rather than showing them a zero", () => {
    isLoggedIn = false;
    ownedKeys = new Set();
    render(<TagPageClient slug="star-wars" />);

    expect(screen.getByText("4 in this tag")).toBeDefined();
    expect(screen.getByText(/Log in to track your progress/)).toBeDefined();
  });
});

describe("the tag directory", () => {
  // The label is the first paragraph in the row; the count and the example
  // follow it, and textContent runs them all together.
  const labels = () =>
    screen.getAllByRole("listitem").map((item) => item.querySelector("p")?.textContent ?? "");

  it("leads with the tags you're furthest along in", () => {
    render(<TagsPageClient />);

    expect(labels()).toEqual(["Star Wars", "Bobblehead Night", "Peanuts", "Sugar Skull"]);
    expect(screen.getByText(/Sorted by how far along you are/)).toBeDefined();
  });

  it("shows each tag's share of the collection", () => {
    render(<TagsPageClient />);

    expect(screen.getByText("9 of 10")).toBeDefined();
    expect(screen.getByText("0 of 4")).toBeDefined();
  });

  // Nothing to sort on yet, and rows that reshuffle under a reader mid-load are
  // worse than rows that arrive in the order the vocabulary came in.
  it("leaves the order alone until the collection lands", () => {
    isLoadingOwned = true;
    render(<TagsPageClient />);

    expect(labels()).toEqual(["Peanuts", "Star Wars", "Sugar Skull", "Bobblehead Night"]);
    expect(screen.queryByText(/Sorted by how far along/)).toBeNull();
  });

  it("keeps the vocabulary's own order for a signed-out reader", () => {
    isLoggedIn = false;
    render(<TagsPageClient />);

    expect(labels()).toEqual(["Peanuts", "Star Wars", "Sugar Skull", "Bobblehead Night"]);
    expect(screen.getByText(/Log in to track how many of each tag/)).toBeDefined();
  });
});
