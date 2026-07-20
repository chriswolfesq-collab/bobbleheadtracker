"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getGiveawayById, getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import { supabase } from "@/lib/supabase";
import { TEAMS } from "@/lib/teams";

export type TeamCount = { teamSlug: string; count: number };

// The collection/favorites/submissions hooks default to the signed-in site
// user (via useAuth + the regular supabase client), but admin mode passes an
// explicit target user id and the admin client so the "view profile" page can
// render any user's profile read-only. Admin reads are allowed by the
// "…: admin select" RLS policies added in supabase/schema.sql.
export type ProfileSource = { userId?: string; client?: SupabaseClient };

// The site total per team is the curated giveaway list (static) plus any
// community-submitted bobbleheads that have been approved for that team.
export function useSiteBobbleheadCounts() {
  const [communityCountByTeamSlug, setCommunityCountByTeamSlug] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("community_bobbleheads")
      .select("team_slug")
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load community bobblehead counts:", error.message);
          setCommunityCountByTeamSlug({});
        } else {
          const counts: Record<string, number> = {};
          for (const row of data ?? []) {
            counts[row.team_slug] = (counts[row.team_slug] ?? 0) + 1;
          }
          setCommunityCountByTeamSlug(counts);
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const totalByTeamSlug: Record<string, number> = {};
  for (const team of TEAMS) {
    totalByTeamSlug[team.slug] =
      getGiveawaysByTeamSlug(team.slug).length + (communityCountByTeamSlug[team.slug] ?? 0);
  }
  const siteTotal = Object.values(totalByTeamSlug).reduce((sum, count) => sum + count, 0);

  return { totalByTeamSlug, siteTotal, isLoading };
}

export function useCollectionSummary(source?: ProfileSource) {
  const { user } = useAuth();
  const client = source?.client ?? supabase;
  const userId = source?.userId ?? user?.id ?? null;
  const [countByTeamSlug, setCountByTeamSlug] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    client
      .from("user_collections")
      .select("team_slug, owned")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your collection summary:", error.message);
          setCountByTeamSlug({});
        } else {
          const counts: Record<string, number> = {};
          for (const row of data ?? []) {
            if (!row.owned) continue;
            counts[row.team_slug] = (counts[row.team_slug] ?? 0) + 1;
          }
          setCountByTeamSlug(counts);
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, client]);

  const resolvedCounts = userId ? countByTeamSlug : {};
  const totalOwned = Object.values(resolvedCounts).reduce((sum, count) => sum + count, 0);

  return { countByTeamSlug: resolvedCounts, totalOwned, isLoading: userId ? isLoading : false };
}

export type MyShelf = {
  /** null until the user has enabled sharing at least once. */
  slug: string | null;
  isPublic: boolean;
};

// Returned by useMyShelf. Named so the profile page can call the hook once and
// hand the result to both the privacy toggle and the share buttons, rather than
// each calling the hook and refetching the same row.
export type ShelfSharing = {
  shelf: MyShelf;
  isLoading: boolean;
  isSaving: boolean;
  setPublic: (isPublic: boolean) => Promise<{ error: string | null }>;
};

// The signed-in user's public-shelf settings. Reads profiles directly (allowed
// by the "profiles: owner select" policy) but writes through the
// enable/disable RPCs, because profiles has no update policy — the client must
// not be able to pick its own slug and squat someone else's shelf URL.
//
// No ProfileSource here, unlike the hooks above: this is a settings surface for
// your own account, and there's deliberately no admin path to publish someone
// else's shelf on their behalf.
export function useMyShelf(): ShelfSharing {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [shelf, setShelf] = useState<MyShelf>({ slug: null, isPublic: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    supabase
      .from("profiles")
      .select("slug, is_public")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your shelf settings:", error.message);
        } else {
          setShelf({ slug: data?.slug ?? null, isPublic: data?.is_public ?? false });
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function setPublic(isPublic: boolean): Promise<{ error: string | null }> {
    if (!userId) return { error: "Not signed in." };

    setIsSaving(true);
    const { data, error } = isPublic
      ? await supabase.rpc("enable_public_shelf")
      : await supabase.rpc("disable_public_shelf");
    setIsSaving(false);

    if (error) {
      console.error("Failed to update your shelf settings:", error.message);
      return { error: "Couldn't update your shelf. Try again." };
    }

    // enable_public_shelf returns the slug, minting it on the first call;
    // disable returns nothing and leaves the slug alone, so the URL survives a
    // round trip through private and back.
    setShelf((current) => ({
      slug: isPublic ? ((data as string | null) ?? current.slug) : current.slug,
      isPublic,
    }));
    return { error: null };
  }

  return {
    shelf: userId ? shelf : { slug: null, isPublic: false },
    isLoading: userId ? isLoading : false,
    isSaving,
    setPublic,
  };
}

export type EmailAlerts = {
  enabled: boolean;
  isLoading: boolean;
  isSaving: boolean;
  setEnabled: (enabled: boolean) => Promise<{ error: string | null }>;
};

// The signed-in user's wishlist-alert preference: whether to be emailed when a
// bobblehead on their wishlist gets a new owner (see supabase/wishlist_alerts.sql).
// Reads profiles directly (allowed by "profiles: owner select") but writes
// through set_wishlist_alerts, because profiles has no client update policy —
// same split as useMyShelf above.
export function useEmailAlerts(): EmailAlerts {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Optimistic default matches the column default (on) so the toggle doesn't
  // flicker off before the row loads.
  const [enabled, setEnabledState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    supabase
      .from("profiles")
      .select("email_wishlist_alerts")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your alert settings:", error.message);
        } else {
          setEnabledState(data?.email_wishlist_alerts ?? true);
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function setEnabled(next: boolean): Promise<{ error: string | null }> {
    if (!userId) return { error: "Not signed in." };

    // Optimistic; reverted below if the save fails.
    const previous = enabled;
    setEnabledState(next);
    setIsSaving(true);
    const { error } = await supabase.rpc("set_wishlist_alerts", { p_enabled: next });
    setIsSaving(false);

    if (error) {
      console.error("Failed to update your alert settings:", error.message);
      setEnabledState(previous);
      return { error: "Couldn't update your alerts. Try again." };
    }

    return { error: null };
  }

  return {
    enabled: userId ? enabled : true,
    isLoading: userId ? isLoading : false,
    isSaving,
    setEnabled,
  };
}

export type GallerySharing = {
  enabled: boolean;
  isLoading: boolean;
  isSaving: boolean;
  setEnabled: (enabled: boolean) => Promise<{ error: string | null }>;
};

// The signed-in user's opt-in to show their actual owned bobbleheads and
// favorites on their public shelf, rather than just the counts (see
// supabase/gallery.sql). Reads profiles directly (allowed by "profiles: owner
// select") but writes through set_gallery_public, because profiles has no
// client update policy — same split as useMyShelf / useEmailAlerts above. This
// only has any public effect while the shelf itself is public; the gallery RPC
// gates on both flags.
export function useGallerySharing(): GallerySharing {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Optimistic default matches the column default (off).
  const [enabled, setEnabledState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    supabase
      .from("profiles")
      .select("gallery_public")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your gallery settings:", error.message);
        } else {
          setEnabledState(data?.gallery_public ?? false);
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function setEnabled(next: boolean): Promise<{ error: string | null }> {
    if (!userId) return { error: "Not signed in." };

    // Optimistic; reverted below if the save fails.
    const previous = enabled;
    setEnabledState(next);
    setIsSaving(true);
    const { error } = await supabase.rpc("set_gallery_public", { p_enabled: next });
    setIsSaving(false);

    if (error) {
      console.error("Failed to update your gallery settings:", error.message);
      setEnabledState(previous);
      return { error: "Couldn't update your gallery. Try again." };
    }

    return { error: null };
  }

  return {
    enabled: userId ? enabled : false,
    isLoading: userId ? isLoading : false,
    isSaving,
    setEnabled,
  };
}

export type MySubmission = {
  id: string;
  kind: "photo_for_existing" | "new_bobblehead";
  teamSlug: string;
  title: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  imageUrl: string | null;
  href: string | null;
};

// Pending/rejected photos still live in the private bobblehead-pending bucket
// (readable by their owner via RLS), while approved photos were copied to the
// public bobblehead-approved bucket under `${submissionId}-${filename}` (see
// moveToApproved in app/admin/review/page.tsx) — so the URL has to be derived
// differently depending on status.
function approvedSubmissionImageUrl(
  client: SupabaseClient,
  submissionId: string,
  storagePath: string | null,
): string | null {
  if (!storagePath) return null;
  const filename = storagePath.split("/").pop() ?? "photo";
  const { data } = client.storage
    .from("bobblehead-approved")
    .getPublicUrl(`${submissionId}-${filename}`);
  return data.publicUrl ?? null;
}

// One signed-URL request for all pending/rejected photos rather than one per
// submission. Paths that fail to sign are simply absent from the map.
async function signPendingImageUrls(
  client: SupabaseClient,
  storagePaths: (string | null)[],
): Promise<Map<string, string>> {
  const paths = storagePaths.filter((path): path is string => Boolean(path));
  if (paths.length === 0) return new Map();

  const { data } = await client.storage
    .from("bobblehead-pending")
    .createSignedUrls(paths, 60 * 10);

  return new Map(
    (data ?? []).flatMap((item) =>
      item.path && item.signedUrl ? [[item.path, item.signedUrl] as [string, string]] : [],
    ),
  );
}

// A submission only becomes a real listing once it's approved. photo_for_existing
// points at either a curated bobblehead (static list) or a community one; new_bobblehead
// becomes a community_bobbleheads row whose generated id ends in the submission's
// first 8 chars (see approve_submission() in supabase/schema.sql), so we look it up that way.
async function resolveSubmissionHref(
  client: SupabaseClient,
  status: MySubmission["status"],
  kind: MySubmission["kind"],
  submissionId: string,
  teamSlug: string,
  targetBobbleheadId: string | null,
): Promise<string | null> {
  if (status !== "approved") return null;

  if (kind === "photo_for_existing") {
    if (!targetBobbleheadId) return null;
    const isCurated = getGiveawaysByTeamSlug(teamSlug).some((g) => g.id === targetBobbleheadId);
    return isCurated
      ? `/teams/${teamSlug}/bobbleheads/${targetBobbleheadId}`
      : `/teams/${teamSlug}/community?id=${encodeURIComponent(targetBobbleheadId)}`;
  }

  const { data } = await client
    .from("community_bobbleheads")
    .select("id")
    .eq("team_slug", teamSlug)
    .like("id", `%-${submissionId.slice(0, 8)}`)
    .maybeSingle();

  return data ? `/teams/${teamSlug}/community?id=${encodeURIComponent(data.id)}` : null;
}

export function useMySubmissions(source?: ProfileSource) {
  const { user } = useAuth();
  const client = source?.client ?? supabase;
  const userId = source?.userId ?? user?.id ?? null;
  const [submissions, setSubmissions] = useState<MySubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    client
      .from("submissions")
      .select("id, kind, team_slug, title, status, created_at, storage_path, target_bobblehead_id")
      .eq("submitted_by", userId)
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your submissions:", error.message);
          setSubmissions([]);
          setIsLoading(false);
          return;
        }

        const rows = data ?? [];
        const signedUrlByPath = await signPendingImageUrls(
          client,
          rows.filter((row) => row.status !== "approved").map((row) => row.storage_path),
        );

        if (cancelled) return;

        const withDetails = await Promise.all(
          rows.map(async (row) => ({
            id: row.id,
            kind: row.kind,
            teamSlug: row.team_slug,
            title: row.title,
            status: row.status,
            createdAt: row.created_at,
            imageUrl:
              row.status === "approved"
                ? approvedSubmissionImageUrl(client, row.id, row.storage_path)
                : ((row.storage_path && signedUrlByPath.get(row.storage_path)) ?? null),
            href: await resolveSubmissionHref(
              client,
              row.status,
              row.kind,
              row.id,
              row.team_slug,
              row.target_bobblehead_id,
            ),
          })),
        );

        if (cancelled) return;

        setSubmissions(withDetails);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, client]);

  return { submissions: userId ? submissions : [], isLoading: userId ? isLoading : false };
}

export type MyFavorite = {
  bobbleheadId: string;
  teamSlug: string;
  title: string;
  imageUrl: string | null;
  href: string;
};

// Favorites are stored per-team (like user_collections), so building the
// cross-team list for the profile page means resolving each row's title and
// image against either the curated giveaway list or the community_bobbleheads
// table, the same split used elsewhere for a bobblehead's identity.
export function useMyFavorites(source?: ProfileSource) {
  const { user } = useAuth();
  const client = source?.client ?? supabase;
  const userId = source?.userId ?? user?.id ?? null;
  const [favorites, setFavorites] = useState<MyFavorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    client
      .from("user_favorites")
      .select("bobblehead_id, team_slug")
      .eq("user_id", userId)
      .eq("favorited", true)
      .then(async ({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your favorites:", error.message);
          setFavorites([]);
          setIsLoading(false);
          return;
        }

        const rows = data ?? [];

        if (rows.length === 0) {
          setFavorites([]);
          setIsLoading(false);
          return;
        }

        const teamSlugs = Array.from(new Set(rows.map((row) => row.team_slug)));

        const [{ data: communityRows }, { data: photoRows }] = await Promise.all([
          client
            .from("community_bobbleheads")
            .select("id, team_slug, title, image_url")
            .in("team_slug", teamSlugs),
          client.from("approved_photos").select("bobblehead_id, team_slug, image_url").in("team_slug", teamSlugs),
        ]);

        if (cancelled) return;

        const communityByKey = new Map(
          (communityRows ?? []).map((row) => [`${row.team_slug}:${row.id}`, row]),
        );
        const photoByKey = new Map(
          (photoRows ?? []).map((row) => [`${row.team_slug}:${row.bobblehead_id}`, row.image_url]),
        );

        const resolved: MyFavorite[] = rows.map((row) => {
          const key = `${row.team_slug}:${row.bobblehead_id}`;
          const curated = getGiveawayById(row.bobblehead_id, row.team_slug);
          const community = communityByKey.get(key);

          return {
            bobbleheadId: row.bobblehead_id,
            teamSlug: row.team_slug,
            title: curated?.title ?? community?.title ?? "Bobblehead",
            imageUrl: photoByKey.get(key) ?? curated?.imageUrl ?? community?.image_url ?? null,
            href: curated
              ? `/teams/${row.team_slug}/bobbleheads/${row.bobblehead_id}`
              : `/teams/${row.team_slug}/community?id=${encodeURIComponent(row.bobblehead_id)}`,
          };
        });

        setFavorites(resolved);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, client]);

  return { favorites: userId ? favorites : [], isLoading: userId ? isLoading : false };
}

export type MyWanted = {
  bobbleheadId: string;
  teamSlug: string;
  title: string;
  imageUrl: string | null;
  href: string;
};

// Wanted bobbleheads, same cross-team resolution as useMyFavorites above.
export function useMyWanted(source?: ProfileSource) {
  const { user } = useAuth();
  const client = source?.client ?? supabase;
  const userId = source?.userId ?? user?.id ?? null;
  const [wanted, setWanted] = useState<MyWanted[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    client
      .from("user_wants")
      .select("bobblehead_id, team_slug")
      .eq("user_id", userId)
      .eq("wanted", true)
      .then(async ({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your wanted list:", error.message);
          setWanted([]);
          setIsLoading(false);
          return;
        }

        const rows = data ?? [];

        if (rows.length === 0) {
          setWanted([]);
          setIsLoading(false);
          return;
        }

        const teamSlugs = Array.from(new Set(rows.map((row) => row.team_slug)));

        const [{ data: communityRows }, { data: photoRows }] = await Promise.all([
          client
            .from("community_bobbleheads")
            .select("id, team_slug, title, image_url")
            .in("team_slug", teamSlugs),
          client.from("approved_photos").select("bobblehead_id, team_slug, image_url").in("team_slug", teamSlugs),
        ]);

        if (cancelled) return;

        const communityByKey = new Map(
          (communityRows ?? []).map((row) => [`${row.team_slug}:${row.id}`, row]),
        );
        const photoByKey = new Map(
          (photoRows ?? []).map((row) => [`${row.team_slug}:${row.bobblehead_id}`, row.image_url]),
        );

        const resolved: MyWanted[] = rows.map((row) => {
          const key = `${row.team_slug}:${row.bobblehead_id}`;
          const curated = getGiveawayById(row.bobblehead_id, row.team_slug);
          const community = communityByKey.get(key);

          return {
            bobbleheadId: row.bobblehead_id,
            teamSlug: row.team_slug,
            title: curated?.title ?? community?.title ?? "Bobblehead",
            imageUrl: photoByKey.get(key) ?? curated?.imageUrl ?? community?.image_url ?? null,
            href: curated
              ? `/teams/${row.team_slug}/bobbleheads/${row.bobblehead_id}`
              : `/teams/${row.team_slug}/community?id=${encodeURIComponent(row.bobblehead_id)}`,
          };
        });

        setWanted(resolved);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, client]);

  return { wanted: userId ? wanted : [], isLoading: userId ? isLoading : false };
}
