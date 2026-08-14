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
      teamsCompleted: 0,
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

  it("counts a team as complete only when its whole checklist is owned", () => {
    expect(computeShelfStats({ [firstTeam]: 4 }, { [firstTeam]: 5 }).teamsCompleted).toBe(0);
    expect(computeShelfStats({ [firstTeam]: 5 }, { [firstTeam]: 5 }).teamsCompleted).toBe(1);
    // A stale count above the current total still counts as finished.
    expect(computeShelfStats({ [firstTeam]: 7 }, { [firstTeam]: 5 }).teamsCompleted).toBe(1);
  });

  it("never counts an empty checklist as a completed team", () => {
    // A team whose listings have all been deleted is 0 of 0. Awarding that as
    // complete would hand out the completion awards for free.
    const stats = computeShelfStats({}, { [firstTeam]: 0, [secondTeam]: 0 });
    expect(stats.teamsCompleted).toBe(0);
  });
});
