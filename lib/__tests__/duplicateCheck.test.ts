import { describe, expect, it } from "vitest";
import { getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import { findDuplicateBobblehead } from "@/lib/duplicateCheck";

// A real curated listing to test against (data/giveaways/angels.json).
const CURATED = getGiveawaysByTeamSlug("angels")[0];

describe("findDuplicateBobblehead", () => {
  it("finds a curated listing despite casing and punctuation differences", () => {
    const noisyTitle = CURATED.title.toUpperCase().replace(/[()]/g, " ");
    const match = findDuplicateBobblehead("angels", noisyTitle, [], () => false);
    expect(match?.title).toBe(CURATED.title);
  });

  it("returns null for a blank or unmatched title", () => {
    expect(findDuplicateBobblehead("angels", "   ", [], () => false)).toBeNull();
    expect(findDuplicateBobblehead("angels", "No Such Bobblehead 9999", [], () => false)).toBeNull();
  });

  it("skips curated listings the admin deleted", () => {
    // Several angels listings now share a title (the descriptor moved from the
    // title's parenthetical into the nickname), so deleting just one leaves
    // same-titled siblings. Delete every listing with this title to prove the
    // isDeleted filter removes them all and nothing curated matches.
    const deletedIds = new Set(
      getGiveawaysByTeamSlug("angels")
        .filter((giveaway) => giveaway.title === CURATED.title)
        .map((giveaway) => giveaway.id),
    );
    const match = findDuplicateBobblehead("angels", CURATED.title, [], (_team, id) => deletedIds.has(id));
    expect(match?.title ?? null).not.toBe(CURATED.title);
  });

  it("falls back to community listings when nothing curated matches", () => {
    const community = [{ title: "Fictional Test Mascot", date: "July 1, 2023" }];
    const match = findDuplicateBobblehead("angels", "fictional test mascot!", community, () => false);
    expect(match).toEqual(community[0]);
  });

  it("ignores accents when comparing titles", () => {
    // jose-fernandez-2014 is curated as "José Fernández" in the marlins data.
    const match = findDuplicateBobblehead("marlins", "Jose Fernandez", [], () => false);
    expect(match?.title).toContain("Fern");
  });
});
