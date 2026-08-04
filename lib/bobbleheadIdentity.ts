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
  /**
   * True when an admin has deleted the listing. Its detail page 404s, so a
   * public list showing it is offering a dead link — the tag pages, the
   * profile lists and the public shelves all drop these. Admin browsers keep
   * them: a row pointing at a deleted listing is something to see, not hide.
   */
  deleted: boolean;
};

// It takes both halves to name a listing — 36 bobblehead ids are shared between
// teams — so the cross-team lookups all key on the pair. This is the one spelling
// of that key, so a set built from one table can be probed with rows from another.
export function listingKey(teamSlug: string, bobbleheadId: string): string {
  return `${teamSlug}:${bobbleheadId}`;
}

// Curated listings have a dedicated detail page; community-only ones open
// through the community view with the id as a query param.
export function bobbleheadHref(teamSlug: string, bobbleheadId: string, isCurated: boolean): string {
  return isCurated
    ? `/teams/${teamSlug}/bobbleheads/${bobbleheadId}`
    : `/teams/${teamSlug}/community/${encodeURIComponent(bobbleheadId)}`;
}

// Fetches the community, approved-photo and admin-edit rows for a set of teams
// once, then returns a synchronous resolver mapping a (team_slug,
// bobblehead_id) pair to its identity. Fetching up front (rather than per row)
// keeps this to three queries regardless of how many bobbleheads are resolved.
//
// The overrides are the third read because the curated catalog resolved here is
// build-time data: without them a tagged, favorited or owned listing kept the
// title it shipped with — so the same bobblehead read "Star Wars Weekend
// Bobblehead (Jedi Themed)" on a tag page and "Jordan Westburg" on its own —
// and a listing an admin had deleted still rendered a card linking to a 404.
export async function buildBobbleheadResolver(
  client: SupabaseClient,
  teamSlugs: string[],
): Promise<(teamSlug: string, bobbleheadId: string) => BobbleheadIdentity> {
  const [{ data: communityRows }, { data: photoRows }, { data: overrideRows }] = await Promise.all([
    client
      .from("community_bobbleheads")
      .select("id, team_slug, title, image_url")
      .in("team_slug", teamSlugs),
    client
      .from("approved_photos")
      .select("bobblehead_id, team_slug, image_url")
      .in("team_slug", teamSlugs),
    client
      .from("bobblehead_overrides")
      .select("bobblehead_id, team_slug, title, deleted, photo_hidden")
      .in("team_slug", teamSlugs),
  ]);

  const communityByKey = new Map(
    (communityRows ?? []).map((row) => [`${row.team_slug}:${row.id}`, row]),
  );
  const photoByKey = new Map(
    (photoRows ?? []).map((row) => [`${row.team_slug}:${row.bobblehead_id}`, row.image_url]),
  );
  const overrideByKey = new Map(
    (overrideRows ?? []).map((row) => [`${row.team_slug}:${row.bobblehead_id}`, row]),
  );

  return (teamSlug: string, bobbleheadId: string): BobbleheadIdentity => {
    const key = `${teamSlug}:${bobbleheadId}`;
    const curated = getGiveawayById(bobbleheadId, teamSlug);
    const community = communityByKey.get(key);
    const override = overrideByKey.get(key);
    // A hidden seed photo leaves nothing behind, so the card falls back to the
    // team placeholder rather than the photo an admin took down.
    const seedPhoto = override?.photo_hidden ? null : curated?.imageUrl;

    return {
      bobbleheadId,
      teamSlug,
      title: override?.title ?? curated?.title ?? community?.title ?? "Bobblehead",
      imageUrl: photoByKey.get(key) ?? seedPhoto ?? community?.image_url ?? null,
      href: bobbleheadHref(teamSlug, bobbleheadId, Boolean(curated)),
      deleted: override?.deleted ?? false,
    };
  };
}
