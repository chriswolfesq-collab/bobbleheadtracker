import type { Giveaway } from "@/lib/bobbleheads";

// Which giveaways haven't happened yet, out of every listing the site holds —
// the curated catalog, admin edits to it, and community-submitted listings.
// Until now the only way to see them was to sort a team page by oldest-last and
// scroll. Nothing new is stored; this is a read of data that was already there.
// lib/giveawayFeed.ts assembles the sources; this decides what's still ahead.

export type UpcomingGiveaway = Giveaway & {
  teamSlug: string;
  /** Curated listings have a detail page; community ones live elsewhere. */
  isCurated: boolean;
  /**
   * UTC midnight on the giveaway's date — an anchor for a calendar day, not an
   * instant. Read it back with the UTC getters (see startOfUtcDay); the local
   * ones re-bucket it into whatever day it happens to be in the reader's zone.
   */
  time: number;
};

// A giveaway date is a calendar day, not a moment: "August 21, 2026" is the 21st
// wherever you read it from. So `time` is anchored at UTC midnight and every
// reader agrees which day it names.
//
// This pairs with startOfLocalDay below, and the pairing is the whole point.
// Vercel runs the server in UTC and the reader's browser does not, so anything
// that mixes the two scales disagrees across the wire: the countdown used to
// take local midnight on both sides, which meant the server measured from a UTC
// day and the browser re-measured the same instant from its own — every card
// west of UTC came out a day short, and the resulting text mismatch cost a
// whole-tree re-render on first paint (React #418).
export function startOfUtcDay(time: number): number {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// The reader's own calendar day, put on that same UTC-anchored scale so the two
// can be subtracted. Their zone decides which day "today" is — that part has to
// stay local — but the answer is expressed as a day number, not as an instant.
//
// A giveaway happening this afternoon is still upcoming: comparing against `now`
// rather than the day it falls in would drop it from the strip halfway through
// the morning of the day people most want to see it.
export function startOfLocalDay(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

// The catalog stores dates as human-readable strings ("April 11, 2026"), and
// plenty of entries have none — "N/A", "Unknown", or a year with no day. Only a
// date that parses to a real day can be scheduled, so everything else is out:
// a bobblehead we can't place on a calendar can't be coming up on one.
//
// Date.parse resolves the two families it gets against different zones: an ISO
// form is UTC by spec, while a human-readable one lands on the *runtime's* local
// midnight. Read each back with the matching getters, so the calendar day the
// string names survives whichever zone the server happens to run in, and only
// then re-anchor it at UTC.
const ISO_DATE = /^\d{4}(-\d{2}){0,2}$/;

export function giveawayDayTime(date: string): number | null {
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return null;

  return ISO_DATE.test(date.trim()) ? startOfUtcDay(parsed) : startOfLocalDay(parsed);
}

export function selectUpcoming(
  giveaways: UpcomingGiveaway[] | Array<Giveaway & { teamSlug: string; isCurated: boolean }>,
  now: number,
  limit?: number,
): UpcomingGiveaway[] {
  const floor = startOfLocalDay(now);
  const upcoming: UpcomingGiveaway[] = [];

  for (const giveaway of giveaways) {
    const time = giveawayDayTime(giveaway.date);
    if (time === null || time < floor) continue;
    upcoming.push({ ...giveaway, time });
  }

  // Soonest first — the opposite of every other list on the site, which is the
  // point: the next one out is the one you can still plan around.
  upcoming.sort((a, b) => a.time - b.time || a.title.localeCompare(b.title));

  return typeof limit === "number" ? upcoming.slice(0, limit) : upcoming;
}

// "Sat, Apr 11" — enough to plan around without the year, which is redundant on
// a list that only ever looks forward. Read in UTC, the zone `time` is anchored
// in: left to the local zone this renders the day before for half the world.
export function formatUpcomingDate(time: number): string {
  return new Date(time).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// "in 3 days" / "today" / "tomorrow" — the part people actually scan for.
// Empty for a date that has already passed: selectUpcoming keeps those off the
// list, but a prerendered page outlives the clock it was rendered against, and
// a card that has gone stale should say nothing rather than call yesterday
// "today".
//
// Note which scale each argument is read on: `time` names a fixed calendar day
// (UTC), `now` is a clock whose day depends on where it's read (local). Mixing
// those up is the #418 bug described on startOfUtcDay.
export function formatCountdown(time: number, now: number): string {
  const days = Math.round((startOfUtcDay(time) - startOfLocalDay(now)) / 86_400_000);
  if (days < 0) return "";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  if (days < 14) return "next week";
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}
