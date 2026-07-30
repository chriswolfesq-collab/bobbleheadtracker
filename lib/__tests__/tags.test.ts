import { describe, expect, it } from "vitest";
import {
  matchTags,
  normalizeTagLabel,
  slugifyTag,
  sortTags,
  tagHref,
  validateTagLabel,
} from "@/lib/tags";

const tag = (label: string) => ({ slug: slugifyTag(label), label });

describe("slugifyTag", () => {
  it("makes a URL-safe slug out of a label", () => {
    expect(slugifyTag("Star Wars")).toBe("star-wars");
    expect(slugifyTag("Game of Thrones")).toBe("game-of-thrones");
  });

  // The same fold search uses, so "pena" and "Peña" reach the same tag.
  it("folds diacritics rather than dropping the letter", () => {
    expect(slugifyTag("Peña")).toBe("pena");
  });

  it("collapses punctuation and trims the edges", () => {
    expect(slugifyTag("  Rock, Paper & Scissors!  ")).toBe("rock-paper-scissors");
    expect(slugifyTag("--Sugar--Skull--")).toBe("sugar-skull");
  });

  // These are why validateTagLabel checks the slug and not just the label.
  it("can come back empty", () => {
    expect(slugifyTag("•••")).toBe("");
    expect(slugifyTag("   ")).toBe("");
  });
});

describe("normalizeTagLabel", () => {
  it("collapses the whitespace pasting leaves behind", () => {
    expect(normalizeTagLabel("  Star   Wars \n")).toBe("Star Wars");
  });

  // Casing is the author's choice — "of" shouldn't be title-cased for them.
  it("leaves casing alone", () => {
    expect(normalizeTagLabel("Game of Thrones")).toBe("Game of Thrones");
  });
});

describe("validateTagLabel", () => {
  it("returns the label to store and the slug to key on", () => {
    expect(validateTagLabel("  Sugar  Skull ")).toEqual({
      label: "Sugar Skull",
      slug: "sugar-skull",
    });
  });

  it("rejects one that's too short or too long", () => {
    expect(validateTagLabel("a")).toEqual({ error: expect.stringContaining("at least") });
    expect(validateTagLabel("x".repeat(41))).toEqual({ error: expect.stringContaining("at most") });
  });

  // Passes the length check on the label and would still slug to nothing.
  it("rejects a label with no letters or numbers in it", () => {
    expect(validateTagLabel("•••")).toEqual({
      error: "That tag needs some letters or numbers in it.",
    });
  });
});

describe("tagHref", () => {
  it("points at the tag page", () => {
    expect(tagHref("star-wars")).toBe("/tags/star-wars");
  });
});

describe("sortTags", () => {
  // By label, not slug: "The Simpsons" belongs under T for a reader.
  it("sorts by what's on screen", () => {
    const sorted = sortTags([tag("Peanuts"), tag("Bobblehead Night"), tag("Star Wars")]);
    expect(sorted.map((entry) => entry.label)).toEqual([
      "Bobblehead Night",
      "Peanuts",
      "Star Wars",
    ]);
  });

  it("doesn't mutate what it was given", () => {
    const input = [tag("Zed"), tag("Abe")];
    sortTags(input);
    expect(input.map((entry) => entry.label)).toEqual(["Zed", "Abe"]);
  });
});

describe("matchTags", () => {
  const vocabulary = [tag("Star Wars"), tag("Rock Star"), tag("Peanuts"), tag("Sugar Skull")];

  it("puts a prefix match above a match in the middle", () => {
    const found = matchTags(vocabulary, "star");
    expect(found.map((entry) => entry.label)).toEqual(["Star Wars", "Rock Star"]);
  });

  it("ignores punctuation and case in the query", () => {
    expect(matchTags(vocabulary, "  SUGAR!  ").map((entry) => entry.label)).toEqual([
      "Sugar Skull",
    ]);
  });

  it("offers the vocabulary when nothing has been typed", () => {
    expect(matchTags(vocabulary, "")).toHaveLength(4);
    expect(matchTags(vocabulary, "  ")[0].label).toBe("Peanuts");
  });

  it("returns nothing when nothing matches", () => {
    expect(matchTags(vocabulary, "zzz")).toEqual([]);
  });

  it("honours the limit", () => {
    expect(matchTags(vocabulary, "", 2)).toHaveLength(2);
  });
});
