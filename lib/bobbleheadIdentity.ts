import type { SupabaseClient } from "@supabase/supabase-js";
import { getGiveawayById } from "@/lib/bobbleheads";

// A bobblehead's display identity, assembled from the three sources its title
// and image can come from: the curated catalog (lib/bobbleheads.ts, shipped
// client-side), the community_bobbleheads table, and any admin-approved main
// photo. This shape and the resolver below were previously copy-pasted in
// lib/profile.ts (favorites/wanted/owned), lib/adminCollections.ts, and
// lib/publicShelf.ts; they now share one implementation.
export type BobbleheadIdentity = {
  bobbleheadId: string;
  teamSlug: string;
  title: string;
  imageUrl: string | null;
  href: string;
};

// Curated listings have a dedicated detail page; community-only ones open
// through the community view with the id as a query param.
export function bobbleheadHref(teamSlug: string, bobbleheadId: string, isCurated: boolean): string {
  return isCurated
    ? `/teams/${teamSlug}/bobbleheads/${bobbleheadId}`
    : `/teams/${teamSlug}/community?id=${encodeURIComponent(bobbleheadId)}`;
}

// Fetches the community + approved-photo rows for a set of teams once, then
// returns a synchronous resolver mapping a (team_slug, bobblehead_id) pair to
// its identity. Fetching up front (rather than per row) keeps this to two
// queries regardless of how many bobbleheads are resolved.
export async function buildBobbleheadResolver(
  client: SupabaseClient,
  teamSlugs: string[],
): Promise<(teamSlug: string, bobbleheadId: string) => BobbleheadIdentity> {
  const [{ data: communityRows }, { data: photoRows }] = await Promise.all([
    client
      .from("community_bobbleheads")
      .select("id, team_slug, title, image_url")
      .in("team_slug", teamSlugs),
    client
      .from("approved_photos")
      .select("bobblehead_id, team_slug, image_url")
      .in("team_slug", teamSlugs),
  ]);

  const communityByKey = new Map(
    (communityRows ?? []).map((row) => [`${row.team_slug}:${row.id}`, row]),
  );
  const photoByKey = new Map(
    (photoRows ?? []).map((row) => [`${row.team_slug}:${row.bobblehead_id}`, row.image_url]),
  );

  return (teamSlug: string, bobbleheadId: string): BobbleheadIdentity => {
    const key = `${teamSlug}:${bobbleheadId}`;
    const curated = getGiveawayById(bobbleheadId, teamSlug);
    const community = communityByKey.get(key);

    return {
      bobbleheadId,
      teamSlug,
      title: curated?.title ?? community?.title ?? "Bobblehead",
      imageUrl: photoByKey.get(key) ?? curated?.imageUrl ?? community?.image_url ?? null,
      href: bobbleheadHref(teamSlug, bobbleheadId, Boolean(curated)),
    };
  };
}
