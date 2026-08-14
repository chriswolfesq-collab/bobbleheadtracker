import { TEAMS } from "@/lib/teams";

export type ShelfStats = {
  totalOwned: number;
  siteTotal: number;
  pctComplete: number;
  teamsStarted: number;
  /** Teams where every listing is owned. Requires a non-empty checklist — see below. */
  teamsCompleted: number;
  teamCount: number;
  slotsEmpty: number;
};

/**
 * The headline numbers for a collection, derived from per-team counts.
 *
 * Shared by the profile page and the public shelf page rather than computed in
 * each: the two now show the same figures to different audiences, and a
 * collector comparing their own profile against their public link would notice
 * immediately if the two drifted apart.
 *
 * Everything is reduced over TEAMS, so a stray team_slug that isn't one of the
 * 30 (a renamed franchise, a bad row) contributes to neither side of the ratio
 * rather than inflating the numerator past the denominator.
 */
export function computeShelfStats(
  countByTeamSlug: Record<string, number>,
  totalByTeamSlug: Record<string, number>,
): ShelfStats {
  const totalOwned = TEAMS.reduce((sum, team) => sum + (countByTeamSlug[team.slug] ?? 0), 0);
  const siteTotal = TEAMS.reduce((sum, team) => sum + (totalByTeamSlug[team.slug] ?? 0), 0);
  const teamsStarted = TEAMS.filter((team) => (countByTeamSlug[team.slug] ?? 0) > 0).length;
  // The `total > 0` guard is load-bearing, not defensive: a team whose whole
  // checklist has been deleted has 0 owned of 0, and `owned >= total` would
  // quietly award it as complete. Finishing a team nobody can collect isn't an
  // achievement, and it would hand out the completion awards for free.
  const teamsCompleted = TEAMS.filter((team) => {
    const total = totalByTeamSlug[team.slug] ?? 0;
    return total > 0 && (countByTeamSlug[team.slug] ?? 0) >= total;
  }).length;

  return {
    totalOwned,
    siteTotal,
    pctComplete: siteTotal > 0 ? Math.round((totalOwned / siteTotal) * 100) : 0,
    teamsStarted,
    teamsCompleted,
    teamCount: TEAMS.length,
    slotsEmpty: Math.max(siteTotal - totalOwned, 0),
  };
}
