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
      .select("team_slug, bobblehead_id, title, nickname, quantity, year, date, deleted, photo_hidden");

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

// Approved community listings per team, for server-rendered counts (team page
// <title>). Cached like the other maps; busted by the same revalidate tag.
const getCommunityCountsMap = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const client = createServerSupabase();
    const { data, error } = await client.from("community_bobbleheads").select("team_slug");

    if (error) {
      console.error("Failed to load community counts (server):", error.message);
      return {};
    }

    const map: Record<string, number> = {};
    for (const row of data ?? []) {
      map[row.team_slug] = (map[row.team_slug] ?? 0) + 1;
    }
    return map;
  },
  ["curated-community-counts"],
  { tags: [CURATED_DATA_TAG], revalidate: false },
);

// The listing count a team page actually displays: curated minus deleted plus
// community additions. Keeps <title> in agreement with the page body.
export async function getTeamListingCount(teamSlug: string, curatedCount: number): Promise<number> {
  const [deletedKeys, communityCounts] = await Promise.all([
    getDeletedListingKeys(),
    getCommunityCountsMap(),
  ]);
  let deleted = 0;
  for (const key of deletedKeys) {
    if (key.startsWith(`${teamSlug}/`)) deleted += 1;
  }
  return Math.max(0, curatedCount - deleted + (communityCounts[teamSlug] ?? 0));
}
