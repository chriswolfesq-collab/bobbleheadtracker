import type { Giveaway } from "@/lib/bobbleheads";

/**
 * The catalog stores release dates as human-readable strings ("April 11,
 * 2026"). Parse to a timestamp for sorting, falling back to the year, then to
 * 0 so undated entries sink to the bottom rather than breaking the comparator.
 * This is THE canonical ordering — the team page's default sort and the detail
 * page's prev/next arrows both use it so they always agree.
 */
export function releaseTime(giveaway: Pick<Giveaway, "date" | "year">): number {
  const parsed = Date.parse(giveaway.date);
  if (!Number.isNaN(parsed)) return parsed;
  const year = Number(giveaway.year);
  return Number.isNaN(year) ? 0 : Date.parse(`January 1, ${year}`);
}

export function sortNewestFirst<T extends Pick<Giveaway, "date" | "year">>(giveaways: T[]): T[] {
  return [...giveaways].sort((a, b) => releaseTime(b) - releaseTime(a));
}
