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

export function findDuplicateBobblehead(
  teamSlug: string,
  title: string,
  communityBobbleheads: DuplicateCandidate[],
): DuplicateCandidate | null {
  const normalized = normalizeTitle(title);
  if (!normalized) return null;

  const curated = GIVEAWAYS_BY_TEAM[teamSlug] ?? [];

  return (
    curated.find((giveaway) => normalizeTitle(giveaway.title) === normalized) ??
    communityBobbleheads.find((giveaway) => normalizeTitle(giveaway.title) === normalized) ??
    null
  );
}
