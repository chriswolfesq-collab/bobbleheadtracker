import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import { computeShelfStats, type ShelfStats } from "@/lib/shelfStats";
import { TEAMS } from "@/lib/teams";

export type PublicShelf = {
  displayName: string;
  countByTeamSlug: Record<string, number>;
  totalByTeamSlug: Record<string, number>;
  stats: ShelfStats;
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
