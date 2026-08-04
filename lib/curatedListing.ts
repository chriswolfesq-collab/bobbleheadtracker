import { unstable_cache } from "next/cache";
import type { BobbleheadOverride } from "@/lib/bobbleheadOverrides";
import { createServerSupabase } from "@/lib/supabaseServer";

// One cache tag shared by every curated listing's server-rendered data. The
// revalidate route handler (app/api/revalidate) busts this tag whenever an
// admin edit lands in bobblehead_overrides or approved_photos (fired by the
// DB triggers in supabase/revalidate_trigger.sql), so the prerendered detail
// pages pick up the new title/date/photo without a redeploy.
export const CURATED_DATA_TAG = "curated-data";

export type CuratedListingData = {
  override: BobbleheadOverride | null;
  imageUrl: string | null;
};

function listingKey(teamSlug: string, bobbleheadId: string) {
  return `${teamSlug}/${bobbleheadId}`;
}

// Both reads are whole-table on purpose: the override and approved-photo tables
// only hold the handful of listings an admin has touched, and generateStaticParams
// prerenders thousands of detail pages at build. Fetching per page would be
// thousands of queries; these two cached reads run once and every page looks up
// its row from the resulting map.
const getOverridesMap = unstable_cache(
  async (): Promise<Record<string, BobbleheadOverride>> => {
    const client = createServerSupabase();
    const { data, error } = await client
      .from("bobblehead_overrides")
      .select("team_slug, bobblehead_id, title, nickname, quantity, year, date, city, deleted, photo_hidden");

    if (error) {
      console.error("Failed to load bobblehead overrides (server):", error.message);
      return {};
    }

    const map: Record<string, BobbleheadOverride> = {};
    for (const row of data ?? []) {
      map[listingKey(row.team_slug, row.bobblehead_id)] = {
        title: row.title,
        nickname: row.nickname,
        quantity: row.quantity,
        year: row.year,
        date: row.date,
        city: row.city,
        deleted: row.deleted,
        photoHidden: row.photo_hidden,
      };
    }
    return map;
  },
  ["curated-overrides"],
  { tags: [CURATED_DATA_TAG], revalidate: false },
);

const getApprovedPhotosMap = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const client = createServerSupabase();
    const { data, error } = await client
      .from("approved_photos")
      .select("team_slug, bobblehead_id, image_url");

    if (error) {
      console.error("Failed to load approved photos (server):", error.message);
      return {};
    }

    const map: Record<string, string> = {};
    for (const row of data ?? []) {
      map[listingKey(row.team_slug, row.bobblehead_id)] = row.image_url;
    }
    return map;
  },
  ["curated-approved-photos"],
  { tags: [CURATED_DATA_TAG], revalidate: false },
);

// The admin edit / main photo for a single curated listing, resolved on the
// server so the prerendered HTML (what Google and a link preview see) already
// reflects it, rather than the client patching it in after first paint.
export async function getCuratedListingData(
  teamSlug: string,
  bobbleheadId: string,
): Promise<CuratedListingData> {
  const key = listingKey(teamSlug, bobbleheadId);
  const [overrides, photos] = await Promise.all([getOverridesMap(), getApprovedPhotosMap()]);
  return { override: overrides[key] ?? null, imageUrl: photos[key] ?? null };
}

// Every listing an admin has soft-deleted, as "teamSlug/bobbleheadId" keys.
// Used to 404 deleted detail pages, drop them from the sitemap, and skip them
// in prev/next navigation.
export async function getDeletedListingKeys(): Promise<Set<string>> {
  const overrides = await getOverridesMap();
  return new Set(
    Object.entries(overrides)
      .filter(([, override]) => override.deleted)
      .map(([key]) => key),
  );
}

// Every admin edit, and every approved main photo, as "teamSlug/bobbleheadId"
// maps. Server-rendered lists built from the curated catalog have to apply
// these themselves — the catalog is baked into the bundle at build time and
// knows nothing about them.
export function getListingOverrides(): Promise<Record<string, BobbleheadOverride>> {
  return getOverridesMap();
}

export function getApprovedPhotos(): Promise<Record<string, string>> {
  return getApprovedPhotosMap();
}

// The team page's listing count lives in lib/teamListings.ts, counted off the
// merged list the page renders rather than from a second read of its own.
