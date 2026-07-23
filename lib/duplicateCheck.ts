import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";

export type DuplicateCandidate = { title: string; nickname?: string | null; date: string };

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// A listing's identity is its title plus nickname. The descriptor that used to
// live in a title's trailing parenthetical ("Mike Trout (400 HR)") now sits in
// the nickname field, so a submitter matches the same bobblehead whether they
// type the whole thing in the title box or split it across title + nickname —
// both normalize to the same "mike trout 400 hr". A bare "Mike Trout" still
// matches only a bare "Mike Trout", not the 400 HR variant, exactly as it did
// when the descriptor was part of the title.
function identity(title: string, nickname?: string | null): string {
  return normalizeTitle(`${title} ${nickname ?? ""}`);
}

// isDeleted comes from lib/bobbleheadOverrides: a curated listing the admin
// deleted is still in GIVEAWAYS_BY_TEAM, and warning that a removed bobblehead
// is "already on the shelf" would send the submitter looking for something
// that isn't there.
export function findDuplicateBobblehead(
  teamSlug: string,
  title: string,
  nickname: string | null | undefined,
  communityBobbleheads: DuplicateCandidate[],
  isDeleted: (teamSlug: string, bobbleheadId: string) => boolean,
): DuplicateCandidate | null {
  const target = identity(title, nickname);
  if (!target) return null;

  const curated = (GIVEAWAYS_BY_TEAM[teamSlug] ?? []).filter((giveaway) => !isDeleted(teamSlug, giveaway.id));

  return (
    curated.find((giveaway) => identity(giveaway.title, giveaway.nickname) === target) ??
    communityBobbleheads.find((giveaway) => identity(giveaway.title, giveaway.nickname) === target) ??
    null
  );
}
