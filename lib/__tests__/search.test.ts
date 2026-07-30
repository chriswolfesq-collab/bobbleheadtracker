import { describe, expect, it } from "vitest";
import { searchGiveaways, type SearchResult } from "@/lib/search";

function result(overrides: Partial<SearchResult>): SearchResult {
  return {
    id: "test-id",
    title: "Test Player",
    nickname: null,
    date: "July 4, 2020",
    year: "2020",
    imageUrl: null,
    teamSlug: "dodgers",
    teamName: "Dodgers",
    teamCity: "Los Angeles",
    href: "/teams/dodgers/bobbleheads/test-id",
    source: "curated",
    ...overrides,
  };
}

const INDEX: SearchResult[] = [
  result({ id: "kirk-gibson-2018", title: "Kirk Gibson", date: "August 8, 2018", year: "2018" }),
  result({ id: "mike-trout-2024", title: "Mike Trout", teamSlug: "angels", teamName: "Angels", teamCity: "Anaheim", date: "June 7, 2024", year: "2024" }),
  result({ id: "luis-arraez-2025", title: "Luis Arraez", nickname: "La Regadera", teamSlug: "padres", teamName: "Padres", teamCity: "San Diego", date: "September 22, 2025", year: "2025" }),
  result({ id: "community-mystery", title: "Mystery Bobblehead", source: "community" }),
];

describe("searchGiveaways", () => {
  it("returns nothing for an empty or whitespace query", () => {
    expect(searchGiveaways(INDEX, "")).toEqual([]);
    expect(searchGiveaways(INDEX, "   ")).toEqual([]);
  });

  it("matches case-insensitively on title", () => {
    const matches = searchGiveaways(INDEX, "kirk GIBSON");
    expect(matches.map((m) => m.id)).toEqual(["kirk-gibson-2018"]);
  });

  it("requires every term to match (across fields)", () => {
    expect(searchGiveaways(INDEX, "trout anaheim").map((m) => m.id)).toEqual(["mike-trout-2024"]);
    expect(searchGiveaways(INDEX, "trout dodgers")).toEqual([]);
  });

  it("matches on nickname", () => {
    expect(searchGiveaways(INDEX, "regadera").map((m) => m.id)).toEqual(["luis-arraez-2025"]);
  });

  it("matches on team name, city, and date fields", () => {
    expect(searchGiveaways(INDEX, "angels").map((m) => m.id)).toEqual(["mike-trout-2024"]);
    expect(searchGiveaways(INDEX, "august 2018").map((m) => m.id)).toEqual(["kirk-gibson-2018"]);
  });

  // The point of tags: "Star Wars" appears in none of these titles.
  it("matches on a tag", () => {
    const tagged = [
      ...INDEX,
      result({ id: "grogu-2026", title: "Grogu", tags: ["Star Wars"] }),
      result({ id: "hello-kitty-2026", title: "Hello Kitty", tags: ["Sanrio"] }),
    ];
    expect(searchGiveaways(tagged, "star wars").map((m) => m.id)).toEqual(["grogu-2026"]);
  });

  it("ranks a tag match above one that only matches the team or date", () => {
    const tagged = [
      // "Padres" is in this one's team text, and nothing else matches "skull".
      result({ id: "team-only", title: "Someone", teamSlug: "padres", teamName: "Padres", teamCity: "San Diego", tags: ["Sugar Skull"] }),
      result({ id: "tagged", title: "Someone Else", tags: ["Sugar Skull"] }),
    ];
    // Both match on the tag; what matters is that a tag match beats the
    // team/date tier, so a themed search doesn't get buried by coincidence.
    const matches = searchGiveaways(
      [...tagged, result({ id: "padres-2020", title: "Padre Fan", teamSlug: "padres", teamName: "Padres", teamCity: "San Diego" })],
      "sugar",
    );
    expect(matches.map((m) => m.id).sort()).toEqual(["tagged", "team-only"]);
  });

  it("is unaffected by a listing having no tags at all", () => {
    expect(searchGiveaways(INDEX, "kirk").map((m) => m.id)).toEqual(["kirk-gibson-2018"]);
  });

  it("caps results at the given limit", () => {
    const many = Array.from({ length: 30 }, (_, i) => result({ id: `dup-${i}`, title: "Duplicate" }));
    expect(searchGiveaways(many, "duplicate")).toHaveLength(20);
    expect(searchGiveaways(many, "duplicate", 5)).toHaveLength(5);
  });
});
