import { describe, expect, it } from "vitest";
import { AWARDS, type AwardFacts, NO_AWARD_FACTS, evaluateAwards } from "@/lib/awards";
import { TEAMS } from "@/lib/teams";

function facts(overrides: Partial<AwardFacts> = {}): AwardFacts {
  return { ...NO_AWARD_FACTS, ...overrides };
}

const idsOf = (progress: ReturnType<typeof evaluateAwards>) =>
  progress.awards.filter((award) => award.earned).map((award) => award.id);

describe("evaluateAwards — collection ladder", () => {
  it("earns nothing on an empty shelf and points at the first rung", () => {
    const progress = evaluateAwards(facts());

    expect(progress.earnedCount).toBe(0);
    expect(progress.latest).toBeNull();
    expect(progress.next?.award.id).toBe("owned-1");
    expect(progress.next?.progressLabel).toBe("1 to go");
  });

  it("earns a rung the moment the count reaches its threshold", () => {
    expect(idsOf(evaluateAwards(facts({ totalOwned: 9 })))).toEqual(["owned-1"]);
    expect(idsOf(evaluateAwards(facts({ totalOwned: 10 })))).toContain("owned-10");
  });

  it("earns every rung at or below the count", () => {
    const progress = evaluateAwards(facts({ totalOwned: 100 }));

    expect(idsOf(progress)).toEqual(["owned-1", "owned-10", "owned-25", "owned-50", "owned-100"]);
    expect(progress.next?.award.id).toBe("owned-250");
    expect(progress.next?.progressLabel).toBe("150 to go");
  });

  it("treats a missing or nonsense count as an empty shelf", () => {
    // Counts arrive from a network read minus deleted listings, so NaN and
    // negatives are cheaper to absorb than to hunt down.
    for (const totalOwned of [Number.NaN, -5]) {
      expect(evaluateAwards(facts({ totalOwned })).earnedCount).toBe(0);
    }
  });
});

describe("evaluateAwards — team ladders", () => {
  it("scores teams started and teams completed independently", () => {
    // Started 20 teams but finished only one: the started ladder is well up,
    // the completion ladder has just its first rung.
    const progress = evaluateAwards(facts({ teamsStarted: 20, teamsCompleted: 1 }));
    const earned = idsOf(progress);

    expect(earned).toContain("teams-started-20");
    expect(earned).toContain("teams-completed-1");
    expect(earned).not.toContain("teams-started-25");
    expect(earned).not.toContain("teams-completed-5");
  });

  it("counts down team ladders in teams, not bobbleheads", () => {
    const progress = evaluateAwards(facts({ totalOwned: 5000, teamsStarted: 3 }));
    expect(progress.next?.award.id).toBe("teams-started-5");
    expect(progress.next?.progressLabel).toBe("2 teams to go");
  });

  it("uses the singular for a single team remaining", () => {
    const progress = evaluateAwards(facts({ totalOwned: 5000, teamsStarted: 4 }));
    expect(progress.next?.progressLabel).toBe("1 team to go");
  });

  it("tops both team ladders out at the real league size", () => {
    const progress = evaluateAwards(
      facts({ teamsStarted: TEAMS.length, teamsCompleted: TEAMS.length }),
    );
    const earned = idsOf(progress);

    expect(earned).toContain(`teams-started-${TEAMS.length}`);
    expect(earned).toContain(`teams-completed-${TEAMS.length}`);
  });
});

describe("evaluateAwards — founding member", () => {
  it("shows only the tightest band earned", () => {
    // Member #50 clears all four bands; four plates saying one fact is noise.
    const progress = evaluateAwards(facts({ memberNumber: 50 }));
    const founding = progress.awards.filter((award) => award.kind === "founding");

    expect(founding).toHaveLength(1);
    expect(founding[0].id).toBe("founding-100");
    expect(founding[0].earned).toBe(true);
  });

  it("gives a later member their own band", () => {
    const founding = evaluateAwards(facts({ memberNumber: 600 })).awards.filter(
      (award) => award.kind === "founding",
    );

    expect(founding).toHaveLength(1);
    expect(founding[0].id).toBe("founding-1000");
  });

  it("shows nothing at all once a member is past every band", () => {
    // The bands are unwinnable by anyone who arrived late. A standing row of
    // grey plates would just be a reminder of that.
    const progress = evaluateAwards(facts({ memberNumber: 5000 }));
    expect(progress.awards.some((award) => award.kind === "founding")).toBe(false);
  });

  it("shows nothing when the signup rank isn't known", () => {
    // "Not known" and "not earned" are different statements, and an unbackfilled
    // founding member shown a locked plate would read as a demotion.
    const progress = evaluateAwards(facts({ memberNumber: null }));
    expect(progress.awards.some((award) => award.kind === "founding")).toBe(false);
  });

  it("never treats a nonsense rank as a founding member", () => {
    for (const memberNumber of [0, -1, Number.NaN]) {
      const progress = evaluateAwards(facts({ memberNumber }));
      expect(progress.awards.some((award) => award.kind === "founding")).toBe(false);
    }
  });
});

describe("evaluateAwards — team rep", () => {
  it("gives a rep their own team's award, not a generic one", () => {
    const rep = evaluateAwards(facts({ repTeams: ["dodgers"] })).awards.filter(
      (award) => award.kind === "rep",
    );

    expect(rep).toHaveLength(1);
    expect(rep[0].id).toBe("team-rep-dodgers");
    expect(rep[0].name).toBe("Dodgers Rep");
    expect(rep[0].earned).toBe(true);
    // Drives the team's own bobblehead art on the shelf.
    expect(rep[0].teamSlug).toBe("dodgers");
  });

  it("gives one award per team to a rep of several", () => {
    const rep = evaluateAwards(facts({ repTeams: ["cubs", "dodgers"] })).awards.filter(
      (award) => award.kind === "rep",
    );

    expect(rep.map((award) => award.id)).toEqual(["team-rep-cubs", "team-rep-dodgers"]);
  });

  it("orders rep awards by league order, not by the order the rows arrived", () => {
    // Otherwise a two-team rep's shelf reshuffles between loads.
    const forward = evaluateAwards(facts({ repTeams: ["cubs", "dodgers"] }));
    const reversed = evaluateAwards(facts({ repTeams: ["dodgers", "cubs"] }));

    expect(idsOf(reversed)).toEqual(idsOf(forward));
  });

  it("gives a non-rep no rep award at all", () => {
    const notRep = evaluateAwards(facts());
    expect(notRep.awards.some((award) => award.kind === "rep")).toBe(false);
  });

  it("ignores a team slug that isn't a real franchise", () => {
    // team_reps.team_slug is free text by design, so a typo'd or retired slug
    // reaches here and must not render a nameless trophy.
    const progress = evaluateAwards(facts({ repTeams: ["not-a-team", "cubs"] }));
    const rep = progress.awards.filter((award) => award.kind === "rep");

    expect(rep.map((award) => award.id)).toEqual(["team-rep-cubs"]);
  });
});

describe("evaluateAwards — shape", () => {
  it("only offers categories that have something in them", () => {
    const plain = evaluateAwards(facts({ totalOwned: 5 }));
    expect(plain.categories.map((category) => category.id)).toEqual([
      "collection",
      "teams-started",
      "teams-completed",
    ]);

    const decorated = evaluateAwards(facts({ memberNumber: 3, repTeams: ["cubs"] }));
    expect(decorated.categories.map((category) => category.id)).toEqual([
      "collection",
      "teams-started",
      "teams-completed",
      "honors",
    ]);
  });

  it("counts totals over what the member can actually see", () => {
    const progress = evaluateAwards(facts({ totalOwned: 1, memberNumber: 3, repTeams: ["cubs"] }));

    expect(progress.totalCount).toBe(progress.awards.length);
    expect(progress.earnedCount).toBe(idsOf(progress).length);
    // The static catalog is all four founding bands plus the countable
    // ladders; a member sees one founding band and one award per team repped.
    expect(progress.totalCount).toBe(AWARDS.length - 3 + 1);
  });

  it("never proposes an uncountable award as the next one to chase", () => {
    // There's no working toward a founding band or an appointment.
    const progress = evaluateAwards(facts({ memberNumber: 900 }));
    expect(progress.next?.award.kind).not.toBe("founding");
    expect(progress.next?.award.kind).not.toBe("rep");
  });

  it("has no next award once everything is earned", () => {
    const progress = evaluateAwards(
      facts({
        totalOwned: 5000,
        teamsStarted: TEAMS.length,
        teamsCompleted: TEAMS.length,
        memberNumber: 1,
        repTeams: ["cubs"],
      }),
    );

    expect(progress.next).toBeNull();
    expect(progress.earnedCount).toBe(progress.totalCount);
    expect(progress.latest?.id).toBe("team-rep-cubs");
  });

  it("keeps every award id unique", () => {
    const ids = AWARDS.map((award) => award.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps each countable ladder in ascending order", () => {
    // countdown() parses the threshold out of the id, so a ladder that fell out
    // of order would silently mis-rank the next award to chase.
    for (const categoryId of ["collection", "teams-started", "teams-completed"] as const) {
      const thresholds = AWARDS.filter((award) => award.categoryId === categoryId).map((award) =>
        Number.parseInt(award.id.slice(award.id.lastIndexOf("-") + 1), 10),
      );
      expect(thresholds.every(Number.isFinite)).toBe(true);
      expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
    }
  });
});
