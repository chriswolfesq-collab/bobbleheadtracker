import { unstable_cache } from "next/cache";
import type { BobbleheadOverride } from "@/lib/bobbleheadOverrides";
import { parseRarityTier } from "@/lib/rarity";
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
      .select("team_slug, bobblehead_id, title, nickname, quantity, year, date, city, rarity, rarity_note, description, deleted, photo_hidden");

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
        rarity: parseRarityTier(row.rarity),
        rarityNote: row.rarity_note,
        description: row.description,
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

// A listing with no main photo of its own still shows a real photo on its
// detail page: it borrows the first photo from its gallery. This is that same
// fallback, resolved for every listing at once so the grids can use it too —
// without it a listing whose only photo came in through the community pipeline
// is a real photo when you open it and a team placeholder in the list.
//
// Earliest photo per listing, matching the detail page's `galleryPhotos[0]`
// (lib/bobbleheadGallery.ts orders by created_at ascending).
//
// Tag-only, like the two reads above: bobblehead_gallery_photos now has a
// revalidate trigger of its own (supabase/revalidate_trigger.sql), so a gallery
// photo landing busts CURATED_DATA_TAG directly. It used to be time-based for
// want of that trigger, and the 1h window leaked out of here onto every page
// that reads it — all ~3,650 prerendered pages — so each hour a crawler could
// force the entire site to re-render.
const getGalleryPhotosMap = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const client = createServerSupabase();
    const { data, error } = await client
      .from("bobblehead_gallery_photos")
      .select("team_slug, bobblehead_id, image_url")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load gallery photos (server):", error.message);
      return {};
    }

    const map: Record<string, string> = {};
    for (const row of data ?? []) {
      const key = listingKey(row.team_slug, row.bobblehead_id);
      if (!(key in map)) map[key] = row.image_url;
    }
    return map;
  },
  ["curated-gallery-photos"],
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

export function getGalleryPhotos(): Promise<Record<string, string>> {
  return getGalleryPhotosMap();
}

// The team page's listing count lives in lib/teamListings.ts, counted off the
// merged list the page renders rather than from a second read of its own.
