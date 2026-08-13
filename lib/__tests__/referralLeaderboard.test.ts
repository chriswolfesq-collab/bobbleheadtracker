import { describe, expect, it } from "vitest";
import {
  REFERRAL_COLUMNS,
  REFERRAL_WINDOWS,
  referralCount,
  sortByWindow,
  WINDOW_LABELS,
  type ReferralMember,
} from "@/lib/referralLeaderboard";

// The leaderboard reads its cells by constructed key — `qualified_180` and so
// on — so a rename on the SQL side wouldn't fail the build, it would render a
// table of zeroes and quietly hand a giveaway to the wrong person. These tests
// pin the key names against a row captured verbatim from
// admin_referral_leaderboard() in production on 2026-08-13.

const ROBERT: ReferralMember = {
  id: "7e2f47a0-ef03-4bd5-90e1-8f118bf0c484",
  display_name: "Robert Palacioz",
  referral_code: "robert-palacioz",
  joined_total: 2,
  qualified_total: 1,
  joined_7: 2,
  qualified_7: 1,
  joined_30: 2,
  qualified_30: 1,
  joined_60: 2,
  qualified_60: 1,
  joined_90: 2,
  qualified_90: 1,
  joined_180: 2,
  qualified_180: 1,
  joined_365: 2,
  qualified_365: 1,
};

function member(name: string, overrides: Partial<ReferralMember> = {}): ReferralMember {
  const blank = Object.fromEntries(
    REFERRAL_WINDOWS.flatMap((w) => [
      [`joined_${w}`, 0],
      [`qualified_${w}`, 0],
    ]),
  );
  return {
    id: name,
    display_name: name,
    referral_code: name.toLowerCase(),
    joined_total: 0,
    qualified_total: 0,
    ...blank,
    ...overrides,
  } as ReferralMember;
}

describe("the column contract with admin_referral_leaderboard()", () => {
  it("finds a value for every column the table renders", () => {
    for (const column of REFERRAL_COLUMNS) {
      for (const metric of ["joined", "qualified"] as const) {
        expect(
          referralCount(ROBERT, metric, column),
          `${metric}_${column} is missing from the row shape`,
        ).toBeTypeOf("number");
      }
    }
  });

  it("reads the real row correctly", () => {
    expect(referralCount(ROBERT, "joined", 30)).toBe(2);
    expect(referralCount(ROBERT, "qualified", 30)).toBe(1);
    expect(referralCount(ROBERT, "joined", "total")).toBe(2);
    expect(referralCount(ROBERT, "qualified", "total")).toBe(1);
  });

  it("labels every column it offers", () => {
    for (const column of REFERRAL_COLUMNS) {
      expect(WINDOW_LABELS[column]).toBeTruthy();
    }
  });

  // The lenient ?? 0 keeps a partial row from rendering NaN, but it's also what
  // would hide a rename — hence the contract tests above.
  it("reads a missing column as zero rather than undefined", () => {
    expect(referralCount({} as ReferralMember, "qualified", 90)).toBe(0);
  });
});

describe("ranking for a drawing", () => {
  it("sorts by the chosen window, not by lifetime", () => {
    const veteran = member("Veteran", { qualified_total: 50, qualified_365: 50 });
    const recent = member("Recent", { qualified_total: 3, qualified_7: 3, qualified_30: 3 });

    const byWeek = sortByWindow([veteran, recent], "qualified", 7);
    expect(byWeek[0].display_name).toBe("Recent");

    const byYear = sortByWindow([veteran, recent], "qualified", 365);
    expect(byYear[0].display_name).toBe("Veteran");
  });

  it("ranks by entries or by signups depending on the metric", () => {
    // Somebody whose invitees all joined and then never filled a shelf.
    const noisy = member("Noisy", { joined_30: 9, qualified_30: 0 });
    const solid = member("Solid", { joined_30: 2, qualified_30: 2, qualified_total: 2 });

    expect(sortByWindow([noisy, solid], "joined", 30)[0].display_name).toBe("Noisy");
    expect(sortByWindow([noisy, solid], "qualified", 30)[0].display_name).toBe("Solid");
  });

  // Most windows are mostly zeroes; without stable tie-breaks the order would
  // reshuffle between visits, which is unnerving on a page used to pick winners.
  it("breaks ties by lifetime entries, then by name", () => {
    const a = member("Zoe", { qualified_total: 5 });
    const b = member("Adam", { qualified_total: 1 });
    const c = member("Bella", { qualified_total: 1 });

    const ranked = sortByWindow([c, b, a], "qualified", 7).map((m) => m.display_name);
    expect(ranked).toEqual(["Zoe", "Adam", "Bella"]);
  });

  it("leaves the caller's array alone", () => {
    const input = [member("B", { qualified_7: 1 }), member("A", { qualified_7: 9 })];

    sortByWindow(input, "qualified", 7);

    expect(input.map((m) => m.display_name)).toEqual(["B", "A"]);
  });

  it("keeps members who have referred nobody", () => {
    const ranked = sortByWindow([member("Idle"), ROBERT], "qualified", 30);
    expect(ranked.map((m) => m.display_name)).toEqual(["Robert Palacioz", "Idle"]);
  });
});
