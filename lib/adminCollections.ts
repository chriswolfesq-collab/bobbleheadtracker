"use client";

import { useEffect, useState } from "react";
import { getGiveawayById } from "@/lib/bobbleheads";
import { useAdminAuth } from "@/lib/adminAuth";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// One row in an admin "browse a collection type site-wide" list. The same shape
// backs owned/wanted/favorited, community listings, and gallery photos so a
// single presentational component (components/AdminItemsBrowser) can render them
// all — see app/admin/{owned,wanted,favorited,community-listings,gallery-photos}.
export type AdminCollectionItem = {
  key: string;
  title: string;
  // Where the item lives on the public site (its listing or community page).
  href: string;
  imageUrl: string | null;
  teamSlug: string;
  // The user this row belongs to, for the per-user collection types. Community
  // listings and gallery photos have no per-fan owner, so this is omitted.
  owner?: { id: string; name: string } | null;
};

type AdminItemsResult = {
  items: AdminCollectionItem[];
  isLoading: boolean;
  error: string | null;
};

// The three per-user tables share an identical shape: (user_id, team_slug,
// bobblehead_id, <flag>). The flag column matches the table name's intent.
const USER_ITEM_TABLES = {
  owned: { table: "user_collections", flag: "owned" },
  wanted: { table: "user_wants", flag: "wanted" },
  favorited: { table: "user_favorites", flag: "favorited" },
} as const;

export type UserItemKind = keyof typeof USER_ITEM_TABLES;

type AdminUserRow = { id: string; email: string | null; display_name: string | null };

// A bobblehead's identity (title + image) is split across the curated catalog
// (lib/bobbleheads.ts, client-side TS), the community_bobbleheads table, and any
// admin-approved main photo — the same three sources lib/profile.ts resolves
// against. This helper builds the lookup maps for a set of teams and returns a
// resolver keyed by (team_slug, bobblehead_id).
async function buildBobbleheadResolver(teamSlugs: string[]) {
  const [{ data: communityRows }, { data: photoRows }] = await Promise.all([
    supabase
      .from("community_bobbleheads")
      .select("id, team_slug, title, image_url")
      .in("team_slug", teamSlugs),
    supabase
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

  return (teamSlug: string, bobbleheadId: string) => {
    const key = `${teamSlug}:${bobbleheadId}`;
    const curated = getGiveawayById(bobbleheadId, teamSlug);
    const community = communityByKey.get(key);

    return {
      title: curated?.title ?? community?.title ?? "Bobblehead",
      imageUrl: photoByKey.get(key) ?? curated?.imageUrl ?? community?.image_url ?? null,
      // Curated listings have a dedicated page; community-only ones open through
      // the community view with the id as a query param.
      href: curated
        ? `/teams/${teamSlug}/bobbleheads/${bobbleheadId}`
        : `/teams/${teamSlug}/community?id=${encodeURIComponent(bobbleheadId)}`,
    };
  };
}

// Site-wide list of every owned / wanted / favorited row across all users. Each
// row becomes one item labelled with the bobblehead and its owner. Reads through
// the admin client, allowed by the "<table>: admin select" RLS policies.
export function useAdminUserItems(kind: UserItemKind): AdminItemsResult {
  const { isAdmin } = useAdminAuth();
  const { table, flag } = USER_ITEM_TABLES[kind];
  const [items, setItems] = useState<AdminCollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    (async () => {
      const [{ data: rows, error: rowsError }, { data: userRows, error: usersError }] =
        await Promise.all([
          supabase.from(table).select("bobblehead_id, team_slug, user_id").eq(flag, true),
          supabase.rpc("admin_list_users"),
        ]);

      if (cancelled) return;

      if (rowsError || usersError) {
        setError((rowsError ?? usersError)?.message ?? "Could not load items.");
        setItems([]);
        setIsLoading(false);
        return;
      }

      const ownerById = new Map(
        ((userRows ?? []) as AdminUserRow[]).map((user) => [
          user.id,
          user.display_name?.trim() || user.email || "Unknown user",
        ]),
      );

      const teamSlugs = Array.from(new Set((rows ?? []).map((row) => row.team_slug)));
      const resolve =
        teamSlugs.length > 0
          ? await buildBobbleheadResolver(teamSlugs)
          : () => ({ title: "Bobblehead", imageUrl: null, href: "/" });

      if (cancelled) return;

      const resolved: AdminCollectionItem[] = (rows ?? []).map((row) => {
        const bobblehead = resolve(row.team_slug, row.bobblehead_id);
        return {
          key: `${row.user_id}:${row.team_slug}:${row.bobblehead_id}`,
          title: bobblehead.title,
          href: bobblehead.href,
          imageUrl: bobblehead.imageUrl,
          teamSlug: row.team_slug,
          owner: { id: row.user_id, name: ownerById.get(row.user_id) ?? "Unknown user" },
        };
      });

      setError(null);
      setItems(resolved);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, table, flag]);

  return { items, isLoading, error };
}

// Every community-submitted listing across all teams, newest first.
export function useAdminCommunityListings(): AdminItemsResult {
  const { isAdmin } = useAdminAuth();
  const [items, setItems] = useState<AdminCollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    supabase
      .from("community_bobbleheads")
      .select("id, team_slug, title, image_url, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;

        if (fetchError) {
          setError(fetchError.message);
          setItems([]);
          setIsLoading(false);
          return;
        }

        const resolved: AdminCollectionItem[] = (data ?? []).map((row) => ({
          key: `${row.team_slug}:${row.id}`,
          title: row.title,
          href: `/teams/${row.team_slug}/community?id=${encodeURIComponent(row.id)}`,
          imageUrl: row.image_url,
          teamSlug: row.team_slug,
        }));

        setError(null);
        setItems(resolved);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  return { items, isLoading, error };
}

// Every fan-uploaded gallery photo across all listings, newest first. Each photo
// is labelled with the bobblehead it belongs to and links to that listing.
export function useAdminGalleryPhotos(): AdminItemsResult {
  const { isAdmin } = useAdminAuth();
  const [items, setItems] = useState<AdminCollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    supabase
      .from("bobblehead_gallery_photos")
      .select("id, team_slug, bobblehead_id, image_url, created_at")
      .order("created_at", { ascending: false })
      .then(async ({ data, error: fetchError }) => {
        if (cancelled) return;

        if (fetchError) {
          setError(fetchError.message);
          setItems([]);
          setIsLoading(false);
          return;
        }

        const rows = data ?? [];
        const teamSlugs = Array.from(new Set(rows.map((row) => row.team_slug)));
        const resolve =
          teamSlugs.length > 0
            ? await buildBobbleheadResolver(teamSlugs)
            : () => ({ title: "Bobblehead", imageUrl: null, href: "/" });

        if (cancelled) return;

        const resolved: AdminCollectionItem[] = rows.map((row) => {
          const bobblehead = resolve(row.team_slug, row.bobblehead_id);
          return {
            key: row.id,
            title: bobblehead.title,
            href: bobblehead.href,
            // The photo itself is the image here, not the listing's main photo.
            imageUrl: row.image_url,
            teamSlug: row.team_slug,
          };
        });

        setError(null);
        setItems(resolved);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  return { items, isLoading, error };
}
