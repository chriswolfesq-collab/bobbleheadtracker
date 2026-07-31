import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";
import { getCommunityListings } from "@/lib/communityServer";
import { getDeletedListingKeys } from "@/lib/curatedListing";
import { sortNewestFirst } from "@/lib/releaseOrder";

export type ListingNavEntry = {
  id: string;
  title: string;
  /** curated and community listings live under different routes, so each
      neighbor carries its own href rather than one built from the id */
  href: string;
};

export type ListingNav = {
  position: number;
  total: number;
  prev: ListingNavEntry | null;
  next: ListingNavEntry | null;
  /** nearby listings rendered as "related bobbleheads" links */
  related: ListingNavEntry[];
};

type OrderedListing = ListingNavEntry & { date: string; year: string };

/**
 * The arrow chain for one team, in the team page's default order (newest
 * first). It spans BOTH curated and community listings on purpose: the team
 * header counts them together (see getTeamListingCount), so a chain built from
 * the curated data alone left every community submission unreachable and made
 * the "N of M" counter disagree with the header by exactly that team's
 * community count.
 */
export async function buildListingNav(
  teamSlug: string,
  bobbleheadId: string,
): Promise<ListingNav> {
  const [communityListings, deletedKeys] = await Promise.all([
    getCommunityListings(),
    getDeletedListingKeys(),
  ]);

  const curated: OrderedListing[] = (GIVEAWAYS_BY_TEAM[teamSlug] ?? [])
    .filter((entry) => !deletedKeys.has(`${teamSlug}/${entry.id}`))
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      href: `/teams/${teamSlug}/bobbleheads/${entry.id}`,
      date: entry.date,
      year: entry.year,
    }));

  // Community listings aren't filtered by the deleted keys: deleting one drops
  // the row outright, so there's no tombstone to skip (matching the team page).
  const community: OrderedListing[] = communityListings
    .filter((row) => row.teamSlug === teamSlug)
    .map((row) => ({
      id: row.id,
      title: row.title,
      href: `/teams/${teamSlug}/community/${row.id}`,
      date: row.date,
      year: row.year,
    }));

  const ordered = sortNewestFirst([...curated, ...community]);
  const index = ordered.findIndex((entry) => entry.id === bobbleheadId);
  const prev = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;
  // A handful of neighbors double as "related bobbleheads" links so detail
  // pages aren't crawl dead-ends.
  const related = ordered
    .slice(Math.max(0, index - 3), index + 4)
    .filter((entry) => entry.id !== bobbleheadId)
    .map(toEntry);

  return {
    position: index >= 0 ? index + 1 : 1,
    total: ordered.length,
    prev: prev ? toEntry(prev) : null,
    next: next ? toEntry(next) : null,
    related,
  };
}

function toEntry({ id, title, href }: OrderedListing): ListingNavEntry {
  return { id, title, href };
}
