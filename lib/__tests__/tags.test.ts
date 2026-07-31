import { describe, expect, it } from "vitest";
import {
  chooseTagExamples,
  matchTags,
  normalizeTagLabel,
  slugifyTag,
  sortTags,
  sortTagsByProgress,
  type TagAssignment,
  tagCompletionPercent,
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

describe("chooseTagExamples", () => {
  const assignment = (teamSlug: string, bobbleheadId: string, tagSlug: string): TagAssignment => ({
    teamSlug,
    bobbleheadId,
    tagSlug,
  });

  const withPhotos = (ids: string[]) => (a: TagAssignment) =>
    ids.includes(a.bobbleheadId) ? 2 : 0;

  it("picks one example per tag", () => {
    const chosen = chooseTagExamples(
      [
        assignment("dodgers", "grogu-2023", "star-wars"),
        assignment("nationals", "vader-2019", "star-wars"),
        assignment("dodgers", "snoopy-2022", "peanuts"),
      ],
      () => 0,
    );

    expect(Object.keys(chosen).sort()).toEqual(["peanuts", "star-wars"]);
    expect(chosen["peanuts"].bobbleheadId).toBe("snoopy-2022");
  });

  it("prefers the higher-ranked candidate however late it arrives", () => {
    const chosen = chooseTagExamples(
      [
        assignment("dodgers", "aaa-photoless", "star-wars"),
        assignment("nationals", "zzz-with-photo", "star-wars"),
      ],
      withPhotos(["zzz-with-photo"]),
    );

    expect(chosen["star-wars"].bobbleheadId).toBe("zzz-with-photo");
  });

  // The rows come back in whatever order Postgres feels like, so the tie-break
  // is what stops the same tag being illustrated by a different bobblehead on
  // every load.
  it("breaks a tie the same way whatever order the rows arrive in", () => {
    const rows = [
      assignment("nationals", "vader-2019", "star-wars"),
      assignment("dodgers", "grogu-2023", "star-wars"),
    ];

    const forwards = chooseTagExamples(rows, () => 1);
    const backwards = chooseTagExamples([...rows].reverse(), () => 1);

    expect(forwards["star-wars"]).toEqual(backwards["star-wars"]);
    expect(forwards["star-wars"].teamSlug).toBe("dodgers");
  });

  it("has nothing to show for a tag nothing carries", () => {
    expect(chooseTagExamples([], () => 0)).toEqual({});
  });
});

describe("tagCompletionPercent", () => {
  it("reports the share owned", () => {
    expect(tagCompletionPercent(3, 12)).toBe(25);
    expect(tagCompletionPercent(12, 12)).toBe(100);
  });

  // Two of 240 rounds to 0% and reads as untouched, which is a lie about a
  // collection that has started.
  it("never rounds a started tag down to nothing", () => {
    expect(tagCompletionPercent(2, 240)).toBe(1);
  });

  it("is 0 for an empty or untouched tag", () => {
    expect(tagCompletionPercent(0, 12)).toBe(0);
    expect(tagCompletionPercent(0, 0)).toBe(0);
  });
});

describe("sortTagsByProgress", () => {
  const entry = (label: string, ownedCount: number, listingCount: number) => ({
    slug: slugifyTag(label),
    label,
    ownedCount,
    listingCount,
  });

  it("puts the tag you're furthest along in first", () => {
    const sorted = sortTagsByProgress([
      entry("Peanuts", 1, 10),
      entry("Star Wars", 9, 10),
      entry("Sugar Skull", 5, 10),
    ]);

    expect(sorted.map((tag) => tag.label)).toEqual(["Star Wars", "Sugar Skull", "Peanuts"]);
  });

  // The share owned, not the raw count — otherwise the biggest tags always win
  // and "two away from done" is buried under them.
  it("ranks by how much of the tag is left, not by how many you own", () => {
    const sorted = sortTagsByProgress([
      entry("Bobblehead Night", 30, 200),
      entry("Perfect Game", 8, 10),
    ]);

    expect(sorted[0].label).toBe("Perfect Game");
  });

  it("puts the bigger tag first when two are equally far along", () => {
    const sorted = sortTagsByProgress([entry("Peanuts", 4, 10), entry("Star Wars", 40, 100)]);

    expect(sorted[0].label).toBe("Star Wars");
  });

  it("falls back to alphabetical among the untouched", () => {
    const sorted = sortTagsByProgress([
      entry("Zed", 0, 10),
      entry("Abe", 0, 4),
      entry("Star Wars", 1, 10),
    ]);

    expect(sorted.map((tag) => tag.label)).toEqual(["Star Wars", "Abe", "Zed"]);
  });

  it("doesn't mutate what it was given", () => {
    const input = [entry("Abe", 0, 10), entry("Zed", 9, 10)];
    sortTagsByProgress(input);
    expect(input.map((tag) => tag.label)).toEqual(["Abe", "Zed"]);
  });
});
