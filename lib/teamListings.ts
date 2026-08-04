import { resolveAthleticsCity } from "@/lib/athleticsCity";
import type { Giveaway } from "@/lib/bobbleheads";
import type { BobbleheadOverride } from "@/lib/bobbleheadOverrides";
import { getCommunityListings, type CommunityListingRow } from "@/lib/communityServer";
import { getApprovedPhotos, getGalleryPhotos, getListingOverrides } from "@/lib/curatedListing";

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
  galleryPhotos,
  community,
}: {
  teamSlug: string;
  curated: Giveaway[];
  overrides: Record<string, BobbleheadOverride>;
  photos: Record<string, string>;
  /** First gallery photo per listing — see getGalleryPhotos. */
  galleryPhotos: Record<string, string>;
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
      // Main photo, then the curated seed, then the listing's first gallery
      // photo — the same ladder the detail page climbs, so a listing can't show
      // a real photo when you open it and a placeholder in the grid. A removed
      // seed photo drops through to the gallery rather than ending the search:
      // hiding the seed says "not this one", not "no photo at all".
      imageUrl:
        photos[key] ??
        (override?.photoHidden ? null : (giveaway.imageUrl ?? null)) ??
        galleryPhotos[key] ??
        null,
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
      imageUrl:
        photos[listingKey(teamSlug, listing.id)] ??
        listing.imageUrl ??
        galleryPhotos[listingKey(teamSlug, listing.id)] ??
        null,
      source: "community",
    });
  }

  return listings;
}

export async function getTeamListings(
  teamSlug: string,
  curated: Giveaway[],
): Promise<TeamListing[]> {
  const [overrides, photos, galleryPhotos, community] = await Promise.all([
    getListingOverrides(),
    getApprovedPhotos(),
    getGalleryPhotos(),
    getCommunityListings(),
  ]);

  return mergeTeamListings({ teamSlug, curated, overrides, photos, galleryPhotos, community });
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
  return teamSlice(await getApprovedPhotos(), teamSlug);
}

// The same, for the gallery fallback the cards drop to when a listing has no
// main photo — seeded for the same reason, so the client's rebuild doesn't
// flash those cards back to the placeholder before its own fetch lands.
export async function getTeamGallerySeed(teamSlug: string): Promise<Record<string, string>> {
  return teamSlice(await getGalleryPhotos(), teamSlug);
}

// "teamSlug/bobbleheadId" keys down to the bare ids of one team — the shape the
// client hooks key by, since they only ever hold one team at a time.
function teamSlice(byKey: Record<string, string>, teamSlug: string): Record<string, string> {
  const prefix = `${teamSlug}/`;
  const slice: Record<string, string> = {};
  for (const [key, url] of Object.entries(byKey)) {
    if (key.startsWith(prefix)) slice[key.slice(prefix.length)] = url;
  }
  return slice;
}
