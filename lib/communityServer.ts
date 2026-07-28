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

export async function getCommunityListing(
  teamSlug: string,
  bobbleheadId: string,
): Promise<CommunityListingRow | null> {
  const listings = await getCommunityListings();
  return listings.find((row) => row.teamSlug === teamSlug && row.id === bobbleheadId) ?? null;
}
