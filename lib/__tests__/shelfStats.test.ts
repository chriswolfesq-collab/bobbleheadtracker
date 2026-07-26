import { describe, expect, it } from "vitest";
import { computeShelfStats } from "@/lib/shelfStats";
import { TEAMS } from "@/lib/teams";

const firstTeam = TEAMS[0].slug;
const secondTeam = TEAMS[1].slug;

describe("computeShelfStats", () => {
  it("returns an all-zero shelf for empty inputs", () => {
    const stats = computeShelfStats({}, {});
    expect(stats).toEqual({
      totalOwned: 0,
      siteTotal: 0,
      pctComplete: 0,
      teamsStarted: 0,
      teamCount: TEAMS.length,
      slotsEmpty: 0,
    });
  });

  it("sums owned and site totals across teams", () => {
    const owned = { [firstTeam]: 3, [secondTeam]: 2 };
    const total = { [firstTeam]: 5, [secondTeam]: 5 };
    const stats = computeShelfStats(owned, total);

    expect(stats.totalOwned).toBe(5);
    expect(stats.siteTotal).toBe(10);
    expect(stats.pctComplete).toBe(50);
    expect(stats.teamsStarted).toBe(2);
    expect(stats.slotsEmpty).toBe(5);
  });

  it("ignores team slugs that aren't one of the 30 franchises", () => {
    const stats = computeShelfStats({ "not-a-team": 99 }, { "not-a-team": 99 });
    expect(stats.totalOwned).toBe(0);
    expect(stats.siteTotal).toBe(0);
    expect(stats.teamsStarted).toBe(0);
  });

  it("never lets owned exceed the site total in slotsEmpty", () => {
    // A stale count higher than the current site total shouldn't produce a
    // negative "slots empty".
    const stats = computeShelfStats({ [firstTeam]: 10 }, { [firstTeam]: 4 });
    expect(stats.slotsEmpty).toBe(0);
  });

  it("rounds pctComplete to the nearest whole percent", () => {
    const stats = computeShelfStats({ [firstTeam]: 1 }, { [firstTeam]: 3 });
    expect(stats.pctComplete).toBe(33);
  });
});
