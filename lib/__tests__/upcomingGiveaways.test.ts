import { describe, expect, it } from "vitest";
import type { Giveaway } from "@/lib/bobbleheads";
import {
  formatCountdown,
  formatUpcomingDate,
  giveawayDayTime,
  selectUpcoming,
  startOfLocalDay,
  startOfUtcDay,
} from "@/lib/upcomingGiveaways";

const entry = (over: Partial<Giveaway> & { teamSlug?: string; isCurated?: boolean } = {}) => ({
  id: "x",
  title: "Someone",
  year: "2026",
  date: "April 11, 2026",
  teamSlug: "brewers",
  isCurated: true,
  ...over,
});

// A reader's clock, so this one is deliberately local: mid-afternoon on April 11
// wherever the test runs. The "a giveaway today is still upcoming" cases need a
// time of day that isn't midnight to mean anything.
const NOON_APRIL_11 = new Date(2026, 3, 11, 14, 30).getTime();

// Everything here turns on a server and a reader disagreeing about which day an
// instant falls in, so a UTC runner would pass these for the wrong reason —
// startOfUtcDay and startOfLocalDay collapse into the same function there.
// `npm test` pins TZ=America/Los_Angeles; this fails loudly if that goes away.
describe("the test environment", () => {
  it("runs somewhere that isn't UTC, or these tests prove nothing", () => {
    expect(new Date(2026, 3, 11).getTimezoneOffset()).not.toBe(0);
  });
});

describe("giveawayDayTime", () => {
  // Anchored at UTC midnight rather than the server's own, so the number that
  // travels to the browser names the same calendar day at both ends. Reading
  // this as local midnight is what put every countdown a day out west of UTC.
  it("anchors the catalog's human-readable dates at UTC midnight", () => {
    expect(giveawayDayTime("April 11, 2026")).toBe(Date.UTC(2026, 3, 11));
  });

  // The other family Date.parse can hand back. An ISO string is already UTC by
  // spec, so re-reading it with the local getters would walk it a day backwards.
  it("keeps the day an ISO date names", () => {
    expect(giveawayDayTime("2026-04-11")).toBe(Date.UTC(2026, 3, 11));
    expect(giveawayDayTime("2026")).toBe(Date.UTC(2026, 0, 1));
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
    expect(row.time).toBe(Date.UTC(2026, 4, 4));
  });
});

describe("startOfUtcDay", () => {
  it("strips the time of day", () => {
    expect(startOfUtcDay(Date.UTC(2026, 3, 11, 14, 30))).toBe(Date.UTC(2026, 3, 11));
  });

  // The distinction the two functions exist for: a giveaway's day is fixed, so
  // it is read in the zone it was written in and not the one it's read from.
  it("does not re-bucket an anchored day into the local zone", () => {
    expect(startOfUtcDay(Date.UTC(2026, 3, 11))).toBe(Date.UTC(2026, 3, 11));
  });
});

describe("startOfLocalDay", () => {
  it("gives the reader's own day, on the UTC-anchored scale", () => {
    expect(startOfLocalDay(NOON_APRIL_11)).toBe(Date.UTC(2026, 3, 11));
  });
});

describe("formatUpcomingDate", () => {
  it("gives the weekday and day, without the year", () => {
    expect(formatUpcomingDate(Date.UTC(2026, 3, 11))).toBe("Sat, Apr 11");
  });

  // Read locally, a UTC-midnight anchor renders as the previous evening — so
  // this said "Fri, Apr 10" to everyone west of UTC.
  it("names the anchored day, not the one it lands on locally", () => {
    expect(formatUpcomingDate(Date.UTC(2026, 0, 1))).toBe("Thu, Jan 1");
  });
});

describe("formatCountdown", () => {
  const from = (month: number, day: number) =>
    formatCountdown(Date.UTC(2026, month, day), NOON_APRIL_11);

  it("names the near days rather than counting them", () => {
    expect(from(3, 11)).toBe("today");
    expect(from(3, 12)).toBe("tomorrow");
  });

  // Counted off midnights, not elapsed hours — otherwise "tomorrow" at 2:30pm
  // is 33 hours away and rounds to two days.
  it("counts days from midnight, not from now", () => {
    expect(from(3, 14)).toBe("in 3 days");
  });

  // The React #418 regression, in the shape production had it: Vercel anchors
  // the giveaway at UTC midnight and the reader's browser is hours behind, so
  // re-deriving the day locally landed on April 13 and captioned a card three
  // days out "in 2 days" — wrong on screen, and a text mismatch that threw away
  // the hydrated tree on first paint. The count is a property of the two
  // calendar days, so the reader's offset must not enter into it.
  it("gives a reader west of UTC the same count as the server", () => {
    const giveaway = Date.UTC(2026, 3, 14);

    // Every hour of April 11 as lived in this zone — the whole local day has to
    // agree, not just the hour the test happens to run at.
    for (let hour = 0; hour < 24; hour += 1) {
      expect(formatCountdown(giveaway, new Date(2026, 3, 11, hour).getTime())).toBe("in 3 days");
    }
  });

  // The same guarantee at the boundary that used to break: a giveaway on the 1st
  // is still the 1st for a reader whose clock says the previous evening.
  it("holds across a month boundary", () => {
    expect(formatCountdown(Date.UTC(2026, 4, 1), new Date(2026, 3, 30, 23).getTime())).toBe(
      "tomorrow",
    );
  });

  it("gets vaguer the further out it looks", () => {
    expect(from(3, 20)).toBe("next week");
    expect(from(4, 4)).toBe("in 3 weeks");
    expect(from(8, 5)).toBe("in 5 months");
  });

  // A prerendered card can outlive the clock it was rendered against. Saying
  // nothing is right; calling yesterday "today" is what a stale homepage did.
  it("says nothing about a date that has passed", () => {
    expect(from(3, 10)).toBe("");
    expect(from(2, 1)).toBe("");
  });
});
