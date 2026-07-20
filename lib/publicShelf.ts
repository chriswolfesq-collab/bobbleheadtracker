import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { getGiveawayById, getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import { computeShelfStats, type ShelfStats } from "@/lib/shelfStats";
import { TEAMS } from "@/lib/teams";

export type PublicShelf = {
  displayName: string;
  countByTeamSlug: Record<string, number>;
  totalByTeamSlug: Record<string, number>;
  stats: ShelfStats;
};

export type PublicGalleryItem = {
  kind: "owned" | "favorite";
  bobbleheadId: string;
  teamSlug: string;
  title: string;
  imageUrl: string | null;
  href: string;
};

// A client of its own rather than the one from lib/supabase.ts: that one is a
// module-level singleton configured for a browser, and it persists its session.
// On a server that singleton is shared by every concurrent request, so anything
// that ever wrote a session to it would leak that session between visitors.
// This one holds no session at all and only ever calls the public RPC.
function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * A collector's public shelf, or null if the slug is unknown or its owner has
 * sharing turned off. The two are deliberately indistinguishable — both render
 * as a 404 — so nobody can probe for who has a shelf.
 *
 * Wrapped in React's cache() because the page and its generateMetadata both
 * need this, and they'd otherwise each pay for the round trip on every request.
 */
export const getPublicShelf = cache(async (slug: string): Promise<PublicShelf | null> => {
  const client = createServerClient();

  const [shelfResult, communityResult] = await Promise.all([
    client.rpc("get_public_shelf", { p_slug: slug }),
    client.from("community_bobbleheads").select("team_slug"),
  ]);

  if (shelfResult.error) {
    console.error("Failed to load public shelf:", shelfResult.error.message);
    return null;
  }

  // get_public_shelf returns at most one row, and no rows for an unknown slug
  // or a private shelf.
  const row = (shelfResult.data as { display_name: string; counts: Record<string, number> }[] | null)?.[0];
  if (!row) return null;

  if (communityResult.error) {
    console.error("Failed to load community bobblehead counts:", communityResult.error.message);
  }

  // Site total per team is the curated giveaway list (static) plus approved
  // community submissions, matching useSiteBobbleheadCounts in lib/profile.ts.
  const communityCountByTeamSlug: Record<string, number> = {};
  for (const community of communityResult.data ?? []) {
    communityCountByTeamSlug[community.team_slug] =
      (communityCountByTeamSlug[community.team_slug] ?? 0) + 1;
  }

  const totalByTeamSlug: Record<string, number> = {};
  for (const team of TEAMS) {
    totalByTeamSlug[team.slug] =
      getGiveawaysByTeamSlug(team.slug).length + (communityCountByTeamSlug[team.slug] ?? 0);
  }

  const countByTeamSlug = row.counts ?? {};

  return {
    displayName: row.display_name,
    countByTeamSlug,
    totalByTeamSlug,
    stats: computeShelfStats(countByTeamSlug, totalByTeamSlug),
  };
});

/**
 * The owned and favorited items a collector has opted to show on their public
 * shelf, resolved to title/image/href. Empty unless the owner has both shared
 * their shelf and turned the gallery on — get_public_gallery enforces that, so
 * a private or un-opted-in shelf simply yields no items and no gallery renders.
 *
 * Identity resolution mirrors useMyFavorites in lib/profile.ts: each row is a
 * bobblehead_id + team_slug that's either a curated giveaway (static list) or a
 * community submission, with an approved photo overriding the image when present.
 * Done here on the server rather than in the client hooks because those read the
 * private per-user tables as their owner, and a visitor is neither.
 */
export const getPublicGallery = cache(async (slug: string): Promise<PublicGalleryItem[]> => {
  const client = createServerClient();

  const { data, error } = await client.rpc("get_public_gallery", { p_slug: slug });
  if (error) {
    console.error("Failed to load public gallery:", error.message);
    return [];
  }

  const rows = (data as { bobblehead_id: string; team_slug: string; kind: string }[] | null) ?? [];
  if (rows.length === 0) return [];

  const teamSlugs = Array.from(new Set(rows.map((row) => row.team_slug)));

  const [communityResult, photoResult] = await Promise.all([
    client
      .from("community_bobbleheads")
      .select("id, team_slug, title, image_url")
      .in("team_slug", teamSlugs),
    client
      .from("approved_photos")
      .select("bobblehead_id, team_slug, image_url")
      .in("team_slug", teamSlugs),
  ]);

  if (communityResult.error) {
    console.error("Failed to load community bobbleheads for gallery:", communityResult.error.message);
  }
  if (photoResult.error) {
    console.error("Failed to load approved photos for gallery:", photoResult.error.message);
  }

  const communityByKey = new Map(
    (communityResult.data ?? []).map((row) => [`${row.team_slug}:${row.id}`, row]),
  );
  const photoByKey = new Map(
    (photoResult.data ?? []).map((row) => [`${row.team_slug}:${row.bobblehead_id}`, row.image_url]),
  );

  return rows.map((row) => {
    const key = `${row.team_slug}:${row.bobblehead_id}`;
    const curated = getGiveawayById(row.bobblehead_id, row.team_slug);
    const community = communityByKey.get(key);

    return {
      kind: row.kind === "favorite" ? "favorite" : "owned",
      bobbleheadId: row.bobblehead_id,
      teamSlug: row.team_slug,
      title: curated?.title ?? community?.title ?? "Bobblehead",
      imageUrl: photoByKey.get(key) ?? curated?.imageUrl ?? community?.image_url ?? null,
      href: curated
        ? `/teams/${row.team_slug}/bobbleheads/${row.bobblehead_id}`
        : `/teams/${row.team_slug}/community?id=${encodeURIComponent(row.bobblehead_id)}`,
    };
  });
});
