"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { buildBobbleheadResolver } from "@/lib/bobbleheadIdentity";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// The owned/wanted/favorited table + flag are chosen at runtime, which the
// per-table generated types can't express; that one query uses an untyped view
// of the client while every static query keeps full typing.
const untyped = supabase as unknown as SupabaseClient;

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
          untyped.from(table).select("bobblehead_id, team_slug, user_id").eq(flag, true),
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
      // Only built when there are rows to resolve; a non-empty `rows` guarantees
      // a non-empty `teamSlugs`, so `resolve` is set wherever it's called below.
      const resolve = teamSlugs.length > 0 ? await buildBobbleheadResolver(supabase, teamSlugs) : null;

      if (cancelled) return;

      const resolved: AdminCollectionItem[] = (rows ?? []).map((row) => {
        const bobblehead = resolve!(row.team_slug, row.bobblehead_id);
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

export type AdminPublicShelf = {
  id: string;
  slug: string;
  displayName: string;
};

// Every collector who has opted their shelf public. Reads profiles (allowed by
// the "profiles: admin select" RLS policy) filtered to is_public; each links to
// its /shelf/<slug> page.
export function useAdminPublicShelves() {
  const { isAdmin } = useAdminAuth();
  const [shelves, setShelves] = useState<AdminPublicShelf[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    supabase
      .from("profiles")
      .select("id, slug, display_name")
      .eq("is_public", true)
      .order("display_name", { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;

        if (fetchError) {
          setError(fetchError.message);
          setShelves([]);
          setIsLoading(false);
          return;
        }

        // A public shelf always has a slug (minted when sharing is enabled), but
        // guard anyway so a half-migrated row can't produce a /shelf/null link.
        const resolved: AdminPublicShelf[] = (data ?? [])
          .filter((row) => row.slug)
          .map((row) => ({
            id: row.id,
            // Non-null by the filter above; the generated type still sees `slug`
            // as nullable because the DB column is.
            slug: row.slug!,
            displayName: row.display_name?.trim() || "Member",
          }));

        setError(null);
        setShelves(resolved);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  return { shelves, isLoading, error };
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
        // Only built when there are rows to resolve; a non-empty `rows`
        // guarantees a non-empty `teamSlugs`, so `resolve` is set below.
        const resolve = teamSlugs.length > 0 ? await buildBobbleheadResolver(supabase, teamSlugs) : null;

        if (cancelled) return;

        const resolved: AdminCollectionItem[] = rows.map((row) => {
          const bobblehead = resolve!(row.team_slug, row.bobblehead_id);
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
