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
  /** Local midnight on the giveaway's date, for sorting and grouping. */
  time: number;
};

// Local midnight today. A giveaway happening this afternoon is still upcoming
// — comparing against `now` would drop it from the strip halfway through the
// morning of the day people most want to see it.
export function startOfDay(now: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// The catalog stores dates as human-readable strings ("April 11, 2026"), and
// plenty of entries have none — "N/A", "Unknown", or a year with no day. Only a
// date that parses to a real day can be scheduled, so everything else is out:
// a bobblehead we can't place on a calendar can't be coming up on one.
export function giveawayDayTime(date: string): number | null {
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? null : parsed;
}

export function selectUpcoming(
  giveaways: UpcomingGiveaway[] | Array<Giveaway & { teamSlug: string; isCurated: boolean }>,
  now: number,
  limit?: number,
): UpcomingGiveaway[] {
  const floor = startOfDay(now);
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
// a list that only ever looks forward.
export function formatUpcomingDate(time: number): string {
  return new Date(time).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// "in 3 days" / "today" / "tomorrow" — the part people actually scan for.
// Empty for a date that has already passed: selectUpcoming keeps those off the
// list, but a prerendered page outlives the clock it was rendered against, and
// a card that has gone stale should say nothing rather than call yesterday
// "today".
export function formatCountdown(time: number, now: number): string {
  const days = Math.round((startOfDay(time) - startOfDay(now)) / 86_400_000);
  if (days < 0) return "";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  if (days < 14) return "next week";
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}
