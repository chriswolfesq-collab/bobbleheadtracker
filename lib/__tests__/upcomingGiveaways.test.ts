import { describe, expect, it } from "vitest";
import type { Giveaway } from "@/lib/bobbleheads";
import {
  formatCountdown,
  formatUpcomingDate,
  giveawayDayTime,
  selectUpcoming,
  startOfDay,
} from "@/lib/upcomingGiveaways";

const entry = (over: Partial<Giveaway> & { teamSlug?: string } = {}) => ({
  id: "x",
  title: "Someone",
  year: "2026",
  date: "April 11, 2026",
  teamSlug: "brewers",
  ...over,
});

// Mid-afternoon, so the "a giveaway today is still upcoming" cases are real.
const NOON_APRIL_11 = new Date(2026, 3, 11, 14, 30).getTime();

describe("giveawayDayTime", () => {
  it("reads the catalog's human-readable dates", () => {
    expect(giveawayDayTime("April 11, 2026")).toBe(new Date(2026, 3, 11).getTime());
  });

  it("is null for the entries that carry no day", () => {
    expect(giveawayDayTime("N/A")).toBeNull();
    expect(giveawayDayTime("Unknown")).toBeNull();
    expect(giveawayDayTime("")).toBeNull();
  });
});

describe("selectUpcoming", () => {
  it("keeps today and drops yesterday", () => {
    const rows = selectUpcoming(
      [
        entry({ id: "today", date: "April 11, 2026" }),
        entry({ id: "yesterday", date: "April 10, 2026" }),
        entry({ id: "tomorrow", date: "April 12, 2026" }),
      ],
      NOON_APRIL_11,
    );

    expect(rows.map((row) => row.id)).toEqual(["today", "tomorrow"]);
  });

  // Everything else on the site is newest-first. This one list runs the other
  // way, because the next giveaway out is the one you can still act on.
  it("puts the soonest first", () => {
    const rows = selectUpcoming(
      [
        entry({ id: "sept", date: "September 5, 2026" }),
        entry({ id: "may", date: "May 4, 2026" }),
        entry({ id: "july", date: "July 4, 2026" }),
      ],
      NOON_APRIL_11,
    );

    expect(rows.map((row) => row.id)).toEqual(["may", "july", "sept"]);
  });

  it("breaks a same-day tie by title, so the order doesn't wander", () => {
    const rows = selectUpcoming(
      [
        entry({ id: "b", title: "Zed", date: "May 4, 2026" }),
        entry({ id: "a", title: "Abe", date: "May 4, 2026" }),
      ],
      NOON_APRIL_11,
    );

    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("leaves out anything without a real date", () => {
    const rows = selectUpcoming(
      [entry({ id: "dated" }), entry({ id: "undated", date: "N/A", year: "2026" })],
      NOON_APRIL_11,
    );

    expect(rows.map((row) => row.id)).toEqual(["dated"]);
  });

  it("honours a limit", () => {
    const rows = selectUpcoming(
      [
        entry({ id: "1", date: "May 1, 2026" }),
        entry({ id: "2", date: "May 2, 2026" }),
        entry({ id: "3", date: "May 3, 2026" }),
      ],
      NOON_APRIL_11,
      2,
    );

    expect(rows.map((row) => row.id)).toEqual(["1", "2"]);
  });

  it("attaches the parsed day, so callers don't re-parse", () => {
    const [row] = selectUpcoming([entry({ date: "May 4, 2026" })], NOON_APRIL_11);
    expect(row.time).toBe(new Date(2026, 4, 4).getTime());
  });
});

describe("startOfDay", () => {
  it("strips the time of day", () => {
    expect(startOfDay(NOON_APRIL_11)).toBe(new Date(2026, 3, 11).getTime());
  });
});

describe("formatUpcomingDate", () => {
  it("gives the weekday and day, without the year", () => {
    expect(formatUpcomingDate(new Date(2026, 3, 11).getTime())).toBe("Sat, Apr 11");
  });
});

describe("formatCountdown", () => {
  const from = (month: number, day: number) =>
    formatCountdown(new Date(2026, month, day).getTime(), NOON_APRIL_11);

  it("names the near days rather than counting them", () => {
    expect(from(3, 11)).toBe("today");
    expect(from(3, 12)).toBe("tomorrow");
  });

  // Counted off local midnights, not elapsed hours — otherwise "tomorrow" at
  // 2:30pm is 33 hours away and rounds to two days.
  it("counts days from midnight, not from now", () => {
    expect(from(3, 14)).toBe("in 3 days");
  });

  it("gets vaguer the further out it looks", () => {
    expect(from(3, 20)).toBe("next week");
    expect(from(4, 4)).toBe("in 3 weeks");
    expect(from(8, 5)).toBe("in 5 months");
  });
});
