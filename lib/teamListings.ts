import { resolveAthleticsCity } from "@/lib/athleticsCity";
import type { Giveaway } from "@/lib/bobbleheads";
import type { BobbleheadOverride } from "@/lib/bobbleheadOverrides";
import { getCommunityListings, type CommunityListingRow } from "@/lib/communityServer";
import { getApprovedPhotos, getListingOverrides } from "@/lib/curatedListing";

// One team's listings as the team page shows them: the curated catalog with
// admin edits applied and deletions removed, plus the approved community
// listings. The client assembles the same thing from its own hooks (see
// TeamPageClient) so edits made this session appear without a rebuild; this is
// the server's copy, so the HTML a crawler or a link preview gets is the real
// list rather than the pre-merge catalog.

/** Also the shape the cards take client-side — see ResolvedGiveaway. */
export type TeamListing = Giveaway & {
  source: "curated" | "community";
  /** Athletics only: the Oakland/Sacramento era. See lib/athleticsCity.ts. */
  city?: string | null;
};

function listingKey(teamSlug: string, bobbleheadId: string) {
  return `${teamSlug}/${bobbleheadId}`;
}

export function mergeTeamListings({
  teamSlug,
  curated,
  overrides,
  photos,
  community,
}: {
  teamSlug: string;
  curated: Giveaway[];
  overrides: Record<string, BobbleheadOverride>;
  photos: Record<string, string>;
  community: CommunityListingRow[];
}): TeamListing[] {
  const listings: TeamListing[] = [];

  for (const giveaway of curated) {
    const key = listingKey(teamSlug, giveaway.id);
    const override = overrides[key];
    if (override?.deleted) continue;

    const year = override?.year ?? giveaway.year;
    listings.push({
      ...giveaway,
      title: override?.title ?? giveaway.title,
      nickname: override?.nickname ?? giveaway.nickname ?? null,
      quantity: override?.quantity ?? giveaway.quantity ?? null,
      year,
      date: override?.date ?? giveaway.date,
      city: resolveAthleticsCity(teamSlug, year, override?.city),
      // A removed seed photo leaves nothing behind, so the card falls back to
      // the team placeholder — same as a listing that never had one.
      imageUrl: photos[key] ?? (override?.photoHidden ? null : (giveaway.imageUrl ?? null)),
      source: "curated",
    });
  }

  for (const listing of community) {
    if (listing.teamSlug !== teamSlug) continue;

    listings.push({
      id: listing.id,
      title: listing.title,
      nickname: listing.nickname,
      quantity: listing.quantity,
      year: listing.year,
      date: listing.date,
      city: resolveAthleticsCity(teamSlug, listing.year, listing.city),
      imageUrl: photos[listingKey(teamSlug, listing.id)] ?? listing.imageUrl,
      source: "community",
    });
  }

  return listings;
}

export async function getTeamListings(
  teamSlug: string,
  curated: Giveaway[],
): Promise<TeamListing[]> {
  const [overrides, photos, community] = await Promise.all([
    getListingOverrides(),
    getApprovedPhotos(),
    getCommunityListings(),
  ]);

  return mergeTeamListings({ teamSlug, curated, overrides, photos, community });
}

// The number the team page's <title> and description quote. Counted off the
// same merged list the page renders, so the two can't disagree — they used to
// be assembled from separate reads of community_bobbleheads, and a build that
// caught an insert between them shipped a title saying 107 over a list of 111.
export async function getTeamListingCount(
  teamSlug: string,
  curated: Giveaway[],
): Promise<number> {
  return (await getTeamListings(teamSlug, curated)).length;
}

// The approved photos for one team, keyed by bare bobblehead id — the shape
// useApprovedPhotos seeds itself from, so the first client paint keeps the
// photos the server already resolved instead of dropping to placeholders while
// the client's own fetch is in flight.
export async function getTeamPhotoSeed(teamSlug: string): Promise<Record<string, string>> {
  const photos = await getApprovedPhotos();
  const prefix = `${teamSlug}/`;
  const seed: Record<string, string> = {};
  for (const [key, url] of Object.entries(photos)) {
    if (key.startsWith(prefix)) seed[key.slice(prefix.length)] = url;
  }
  return seed;
}
