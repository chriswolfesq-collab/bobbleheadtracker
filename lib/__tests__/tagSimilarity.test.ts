import { describe, expect, it } from "vitest";
import { slugifyTag } from "@/lib/tags";
import {
  compareTagSlugs,
  duplicatePairKey,
  findDuplicatePairs,
  findSimilarTags,
} from "@/lib/tagSimilarity";

// What counts as "these two tags are probably one tag". The cost of a false
// positive is a question an admin dismisses; the cost of a false negative is a
// tag's listings split across two pages, neither of them complete. So this
// leans towards asking — but not so far that every tag looks like every other.

const tag = (label: string) => ({ slug: slugifyTag(label), label });

describe("compareTagSlugs", () => {
  it("catches a hyphen or space that moved", () => {
    expect(compareTagSlugs("all-star", "allstar")).toBe("same-words");
    expect(compareTagSlugs("all-star-game", "allstar-game")).toBe("same-words");
  });

  it("catches a plural", () => {
    expect(compareTagSlugs("sugar-skull", "sugar-skulls")).toBe("same-words");
    expect(compareTagSlugs("dog", "dogs")).toBe("same-words");
    expect(compareTagSlugs("no-hitter", "no-hitters")).toBe("same-words");
  });

  it("catches the same words in a different order", () => {
    expect(compareTagSlugs("game-of-thrones", "thrones-game-of")).toBe("same-words");
  });

  it("catches a typo", () => {
    expect(compareTagSlugs("star-wars", "star-wras")).toBe("typo");
    expect(compareTagSlugs("bobblehead-night", "bobblehed-night")).toBe("typo");
  });

  // One edit apart in a short name is usually a different name, not a slip.
  it("doesn't call a short near-miss a typo", () => {
    expect(compareTagSlugs("dogs", "docs")).toBeNull();
    expect(compareTagSlugs("cubs", "cups")).toBeNull();
  });

  // Years are the sharp edge here: consecutive seasons are one character apart
  // and are emphatically not the same tag.
  it("doesn't confuse one year with the next", () => {
    expect(compareTagSlugs("2019", "2018")).toBeNull();
    expect(compareTagSlugs("world-series-2019", "world-series-2018")).toBeNull();
  });

  it("flags one name sitting inside another", () => {
    expect(compareTagSlugs("all-star", "all-star-game")).toBe("overlap");
    expect(compareTagSlugs("bobblehead-night", "night")).toBe("overlap");
  });

  // Both of these are in the live vocabulary, two characters apart, and the
  // difference is a whole word — a qualifier someone added, not a slip.
  it("calls an added word an overlap rather than a typo", () => {
    expect(compareTagSlugs("batting-champion", "nl-batting-champion")).toBe("overlap");
  });

  // A word in common isn't an overlap — only a whole run of words at one end.
  it("ignores a word the two merely share", () => {
    expect(compareTagSlugs("opening-day-hat", "hat-trick-day")).toBeNull();
    expect(compareTagSlugs("star-wars", "rock-star-night")).toBeNull();
  });

  it("leaves unrelated tags alone", () => {
    expect(compareTagSlugs("star-wars", "peanuts")).toBeNull();
    expect(compareTagSlugs("animals", "announcers-broadcasters")).toBeNull();
  });

  // One tag, not two. The picker applies an exact match rather than asking
  // whether you meant it.
  it("doesn't call a tag a duplicate of itself", () => {
    expect(compareTagSlugs("star-wars", "star-wars")).toBeNull();
  });
});

describe("findSimilarTags", () => {
  const vocabulary = [tag("All-Star"), tag("Star Wars"), tag("Peanuts"), tag("Sugar Skull")];

  it("takes what someone typed, not a slug", () => {
    const found = findSimilarTags("  Sugar   Skulls! ", vocabulary);
    expect(found.map((match) => match.tag.label)).toEqual(["Sugar Skull"]);
    expect(found[0].reason).toBe("same-words");
  });

  it("puts the surer match first", () => {
    const found = findSimilarTags("All Star Games", [tag("All-Star Game"), tag("All-Star")]);
    expect(found.map((match) => match.tag.label)).toEqual(["All-Star Game", "All-Star"]);
    expect(found.map((match) => match.reason)).toEqual(["same-words", "overlap"]);
  });

  // Typing a tag that already exists, exactly, isn't a duplicate to warn about
  // — it's that tag, and the picker just applies it.
  it("says nothing when the label is already a tag", () => {
    expect(findSimilarTags("All Star Game", [tag("All-Star Game")])).toEqual([]);
  });

  it("says nothing about a genuinely new tag", () => {
    expect(findSimilarTags("Turn Ahead the Clock", vocabulary)).toEqual([]);
  });

  it("says nothing about an empty or punctuation-only label", () => {
    expect(findSimilarTags("   ", vocabulary)).toEqual([]);
    expect(findSimilarTags("•••", vocabulary)).toEqual([]);
  });
});

describe("findDuplicatePairs", () => {
  it("finds each pair once, whichever way round they were listed", () => {
    const pairs = findDuplicatePairs([tag("Sugar Skulls"), tag("Sugar Skull"), tag("Peanuts")]);

    expect(pairs).toHaveLength(1);
    expect([pairs[0].a.label, pairs[0].b.label]).toEqual(["Sugar Skull", "Sugar Skulls"]);
    expect(pairs[0].key).toBe("sugar-skull|sugar-skulls");
  });

  it("leads with the pairs least likely to be a coincidence", () => {
    const pairs = findDuplicatePairs([
      tag("All-Star"),
      tag("All-Star Game"),
      tag("Star Wars"),
      tag("Star Wras"),
    ]);

    expect(pairs.map((pair) => pair.reason)).toEqual(["typo", "overlap"]);
  });

  it("finds nothing in a clean vocabulary", () => {
    expect(findDuplicatePairs([tag("Star Wars"), tag("Peanuts"), tag("Dogs")])).toEqual([]);
  });
});

describe("duplicatePairKey", () => {
  it("is the same key whichever order the pair arrives in", () => {
    expect(duplicatePairKey("b-tag", "a-tag")).toBe(duplicatePairKey("a-tag", "b-tag"));
  });
});
