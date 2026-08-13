/**
 * The shape of admin_referral_leaderboard()'s rows, and the reading of them.
 *
 * Out here rather than inside app/admin/stats/page.tsx because the column
 * lookup is by constructed name — `qualified_180` and friends — so a rename on
 * the SQL side would not fail a build, it would silently render a table full of
 * zeroes. That is worth a test, and a test wants it importable.
 *
 * See supabase/referral_leaderboard_windows.sql.
 */

/** The windows the function reports, in the order the table shows them. */
export const REFERRAL_WINDOWS = [7, 30, 60, 90, 180, 365] as const;

export type WindowKey = (typeof REFERRAL_WINDOWS)[number] | "total";

/** Raffle entries versus raw signups. A drawing uses "qualified". */
export type ReferralMetric = "qualified" | "joined";

export const REFERRAL_COLUMNS: WindowKey[] = [...REFERRAL_WINDOWS, "total"];

export const WINDOW_LABELS: Record<WindowKey, string> = {
  7: "7d",
  30: "30d",
  60: "60d",
  90: "90d",
  180: "180d",
  365: "1y",
  total: "All time",
};

/** One row per member holding an invite link. Members who have referred nobody
 *  are included on purpose — a rep sitting on zero is the thing you want to see
 *  when judging whether the programme works. */
export type ReferralMember = {
  id: string;
  display_name: string;
  referral_code: string;
  joined_total: number;
  qualified_total: number;
} & Record<`joined_${number}` | `qualified_${number}`, number>;

/**
 * One cell. Missing keys read as 0 rather than undefined so a partial row can
 * never render "NaN" into the table — but see referralLeaderboard.test.ts,
 * which pins the key names so that leniency can't quietly hide a schema drift.
 */
export function referralCount(
  row: ReferralMember,
  metric: ReferralMetric,
  window: WindowKey,
): number {
  return (row as unknown as Record<string, number>)[`${metric}_${window}`] ?? 0;
}

/**
 * Ranked for a drawing: the chosen window first, then lifetime entries, then
 * name. The tie-breaks matter more than they look — most windows are mostly
 * zeroes, and without them the order would be whatever the sort happened to do
 * with them, reshuffling under you between visits.
 */
export function sortByWindow(
  members: ReferralMember[],
  metric: ReferralMetric,
  window: WindowKey,
): ReferralMember[] {
  return [...members].sort((a, b) => {
    const delta = referralCount(b, metric, window) - referralCount(a, metric, window);
    if (delta !== 0) return delta;

    const lifetime = b.qualified_total - a.qualified_total;
    if (lifetime !== 0) return lifetime;

    return a.display_name.localeCompare(b.display_name);
  });
}
