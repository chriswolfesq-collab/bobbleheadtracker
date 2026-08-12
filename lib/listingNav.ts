import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";
import {
  getCommunityListing,
  getCommunityListings,
  type CommunityListingRow,
} from "@/lib/communityServer";
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
  /** Set only when the arrows are following a list the reader came from rather
      than this team's chain, so the counter can say which — see
      lib/listingTrail.ts. */
  source?: string;
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
  knownListing?: CommunityListingRow | null,
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
    .map((row) => toOrdered(teamSlug, row));

  let ordered = sortNewestFirst([...curated, ...community]);
  let index = ordered.findIndex((entry) => entry.id === bobbleheadId);

  // A just-approved listing is live on its own page (getCommunityListing reads
  // straight from the DB on a miss) while the cached snapshot above still
  // predates it. Without this, that listing rebuilds the exact bug this module
  // exists to fix — index -1, so no arrows at all and a total one short — and
  // then ISR pins that HTML for the rest of the revalidate window. Splice the
  // listing in rather than letting the miss degrade the whole chain.
  if (index < 0 && !isCuratedId(teamSlug, bobbleheadId)) {
    const listing = knownListing ?? (await getCommunityListing(teamSlug, bobbleheadId));
    if (listing) {
      ordered = sortNewestFirst([...ordered, toOrdered(teamSlug, listing)]);
      index = ordered.findIndex((entry) => entry.id === bobbleheadId);
    }
  }

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

function toOrdered(teamSlug: string, row: CommunityListingRow): OrderedListing {
  return {
    id: row.id,
    title: row.title,
    href: `/teams/${teamSlug}/community/${row.id}`,
    date: row.date,
    year: row.year,
  };
}

// A curated id that isn't in the chain was deleted by an admin, and its page is
// about to 404 — no point spending a query looking for it among the community
// listings.
function isCuratedId(teamSlug: string, bobbleheadId: string): boolean {
  return (GIVEAWAYS_BY_TEAM[teamSlug] ?? []).some((entry) => entry.id === bobbleheadId);
}
