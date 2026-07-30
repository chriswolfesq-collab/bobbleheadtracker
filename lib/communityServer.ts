import { unstable_cache } from "next/cache";
import { CURATED_DATA_TAG } from "@/lib/curatedListing";
import { createServerSupabase } from "@/lib/supabaseServer";

export type CommunityListingRow = {
  id: string;
  teamSlug: string;
  title: string;
  nickname: string | null;
  quantity: string | null;
  year: string;
  date: string;
  imageUrl: string | null;
};

// All approved community listings, fetched server-side so their pages can be
// server-rendered (metadata + sitemap) instead of living behind a client-only
// query-param URL that crawlers never see. Cached under the same revalidate
// tag as the curated data.
export const getCommunityListings = unstable_cache(
  async (): Promise<CommunityListingRow[]> => {
    const client = createServerSupabase();
    const { data, error } = await client
      .from("community_bobbleheads")
      .select("id, team_slug, title, nickname, quantity, year, date, image_url");

    if (error) {
      console.error("Failed to load community listings (server):", error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      teamSlug: row.team_slug,
      title: row.title,
      nickname: row.nickname,
      quantity: row.quantity,
      year: row.year,
      date: row.date,
      imageUrl: row.image_url,
    }));
  },
  ["community-listings"],
  { tags: [CURATED_DATA_TAG], revalidate: 3600 },
);

// One listing, read straight from the DB with no cache in front of it. Only
// used to cover a miss in the cached snapshot — see getCommunityListing.
async function fetchCommunityListing(
  teamSlug: string,
  bobbleheadId: string,
): Promise<CommunityListingRow | null> {
  const client = createServerSupabase();
  const { data, error } = await client
    .from("community_bobbleheads")
    .select("id, team_slug, title, nickname, quantity, year, date, image_url")
    .eq("team_slug", teamSlug)
    .eq("id", bobbleheadId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load community listing (server):", error.message);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    teamSlug: data.team_slug,
    title: data.title,
    nickname: data.nickname,
    quantity: data.quantity,
    year: data.year,
    date: data.date,
    imageUrl: data.image_url,
  };
}

export async function getCommunityListing(
  teamSlug: string,
  bobbleheadId: string,
): Promise<CommunityListingRow | null> {
  const listings = await getCommunityListings();
  const cached = listings.find((row) => row.teamSlug === teamSlug && row.id === bobbleheadId);
  if (cached) return cached;

  // A miss doesn't mean the listing isn't there — the snapshot above is up to an
  // hour stale, so a just-approved bobblehead is live on the team page (which
  // queries client-side) while this route still 404s it. That 404 then gets
  // cached by the route's own ISR window, so the dead link outlives the stale
  // data. Falling through to a direct read costs one query on the rare miss and
  // keeps a new listing's page reachable the moment it exists.
  return fetchCommunityListing(teamSlug, bobbleheadId);
}
