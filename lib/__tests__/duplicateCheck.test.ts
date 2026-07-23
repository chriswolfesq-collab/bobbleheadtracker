import { describe, expect, it } from "vitest";
import { getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import { findDuplicateBobblehead } from "@/lib/duplicateCheck";

// A real curated listing to test against (data/giveaways/angels.json). Its
// descriptor lives in the nickname now: title "Mike Trout", nickname "400 HR".
const CURATED = getGiveawaysByTeamSlug("angels")[0];

describe("findDuplicateBobblehead", () => {
  it("matches the full title + nickname despite casing and punctuation", () => {
    // A submitter who crams the whole descriptive name into the title box, loudly
    // and with stray punctuation, still matches the split title + nickname on the
    // shelf — both normalize to "mike trout 400 hr".
    const noisyTitle = `${CURATED.title} (${CURATED.nickname})`.toUpperCase();
    const match = findDuplicateBobblehead("angels", noisyTitle, "", [], () => false);
    expect(match?.title).toBe(CURATED.title);
    expect(match?.nickname).toBe(CURATED.nickname);
  });

  it("matches when the descriptor is split across the title and nickname fields", () => {
    const match = findDuplicateBobblehead("angels", CURATED.title, CURATED.nickname, [], () => false);
    expect(match?.nickname).toBe(CURATED.nickname);
  });

  it("distinguishes a different nickname on the same title", () => {
    const match = findDuplicateBobblehead("angels", CURATED.title, "Not A Real Variant 9999", [], () => false);
    expect(match).toBeNull();
  });

  it("returns null for a blank or unmatched title", () => {
    expect(findDuplicateBobblehead("angels", "   ", "", [], () => false)).toBeNull();
    expect(findDuplicateBobblehead("angels", "No Such Bobblehead 9999", "", [], () => false)).toBeNull();
  });

  it("skips curated listings the admin deleted", () => {
    // Several angels listings share the title "Mike Trout" (the descriptor moved
    // to the nickname). Delete every listing with this exact identity so nothing
    // curated matches, proving the isDeleted filter removes them.
    const deletedIds = new Set(
      getGiveawaysByTeamSlug("angels")
        .filter((giveaway) => giveaway.title === CURATED.title && giveaway.nickname === CURATED.nickname)
        .map((giveaway) => giveaway.id),
    );
    const match = findDuplicateBobblehead(
      "angels",
      CURATED.title,
      CURATED.nickname,
      [],
      (_team, id) => deletedIds.has(id),
    );
    expect(match).toBeNull();
  });

  it("falls back to community listings when nothing curated matches", () => {
    const community = [{ title: "Fictional Test Mascot", date: "July 1, 2023" }];
    const match = findDuplicateBobblehead("angels", "fictional test mascot!", "", community, () => false);
    expect(match).toEqual(community[0]);
  });

  it("matches a community listing on its title + nickname too", () => {
    const community = [{ title: "Billy the Marlin", nickname: "Aviation", date: "July 1, 2023" }];
    const match = findDuplicateBobblehead("angels", "Billy the Marlin (Aviation)", "", community, () => false);
    expect(match).toEqual(community[0]);
  });

  it("ignores accents when comparing titles", () => {
    // jose-fernandez-2014 is curated in the marlins data, with no nickname.
    const match = findDuplicateBobblehead("marlins", "José Fernández", "", [], () => false);
    expect(match?.title).toContain("Fern");
  });
});
