import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";

export type DuplicateCandidate = { title: string; date: string };

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// isDeleted comes from lib/bobbleheadOverrides: a curated listing the admin
// deleted is still in GIVEAWAYS_BY_TEAM, and warning that a removed bobblehead
// is "already on the shelf" would send the submitter looking for something
// that isn't there.
export function findDuplicateBobblehead(
  teamSlug: string,
  title: string,
  communityBobbleheads: DuplicateCandidate[],
  isDeleted: (teamSlug: string, bobbleheadId: string) => boolean,
): DuplicateCandidate | null {
  const normalized = normalizeTitle(title);
  if (!normalized) return null;

  const curated = (GIVEAWAYS_BY_TEAM[teamSlug] ?? []).filter((giveaway) => !isDeleted(teamSlug, giveaway.id));

  return (
    curated.find((giveaway) => normalizeTitle(giveaway.title) === normalized) ??
    communityBobbleheads.find((giveaway) => normalizeTitle(giveaway.title) === normalized) ??
    null
  );
}
