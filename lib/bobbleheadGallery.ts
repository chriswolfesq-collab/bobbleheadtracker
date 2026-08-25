"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// createdAt is carried so a replaced photo can keep the slot it was in — the
// gallery is ordered by it, and a replacement that took a fresh timestamp would
// jump to the end of the strip on the next load.
export type GalleryPhoto = { id: string; imageUrl: string; createdAt: string };

// One team's gallery reduced to the first photo per listing — what a card falls
// back to when the listing has no main photo of its own, matching what the
// detail page shows. `seed` carries the server's copy (lib/teamListings.ts) so
// the first client paint keeps those photos instead of dropping to placeholders
// while this fetch is in flight.
export function useTeamGalleryPhotos(teamSlug: string, seed?: Record<string, string>) {
  const [photoUrlById, setPhotoUrlById] = useState<Record<string, string>>(seed ?? {});

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("bobblehead_gallery_photos")
      .select("bobblehead_id, image_url")
      .eq("team_slug", teamSlug)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load team gallery photos:", error.message);
          return;
        }

        const byId: Record<string, string> = {};
        for (const row of data ?? []) {
          if (!(row.bobblehead_id in byId)) byId[row.bobblehead_id] = row.image_url;
        }
        setPhotoUrlById(byId);
      });

    return () => {
      cancelled = true;
    };
  }, [teamSlug]);

  return photoUrlById;
}

// Every team's gallery at once, reduced the same way but keyed by
// "team_slug/bobblehead_id" — curated ids ("hello-kitty-2019") repeat across
// teams, so the bare id is ambiguous once a grid spans all of them. The
// counterpart to useAllApprovedPhotos (lib/approvedPhotos.ts), and read through
// useAllListingPhotos (lib/listingPhotos.ts) rather than directly.
export function useAllGalleryPhotos() {
  const [photoUrlByListing, setPhotoUrlByListing] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("bobblehead_gallery_photos")
      .select("team_slug, bobblehead_id, image_url")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load gallery photos:", error.message);
          return;
        }

        const byListing: Record<string, string> = {};
        for (const row of data ?? []) {
          const key = `${row.team_slug}/${row.bobblehead_id}`;
          if (!(key in byListing)) byListing[key] = row.image_url;
        }
        setPhotoUrlByListing(byListing);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return photoUrlByListing;
}

export function useBobbleheadGallery(teamSlug: string, bobbleheadId: string) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("bobblehead_gallery_photos")
      .select("id, image_url, created_at")
      .eq("team_slug", teamSlug)
      .eq("bobblehead_id", bobbleheadId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load gallery photos:", error.message);
          setPhotos([]);
        } else {
          setPhotos(
            (data ?? []).map((row) => ({
              id: row.id,
              imageUrl: row.image_url,
              createdAt: row.created_at,
            })),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamSlug, bobbleheadId]);

  // For reflecting an admin deletion (lib/adminEdit.ts) without a refetch.
  const removePhotoLocally = useCallback((photoId: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== photoId));
  }, []);

  // For reflecting a photo demoted from main back into the gallery (when an
  // admin promotes a different gallery photo) without a refetch. Appended last,
  // matching the created_at ordering the query would return on reload.
  const addPhotoLocally = useCallback((photo: GalleryPhoto) => {
    setPhotos((current) =>
      current.some((existing) => existing.id === photo.id) ? current : [...current, photo],
    );
  }, []);

  // For reflecting an admin swapping one gallery photo for another. The new row
  // takes the old one's place in the strip rather than being appended, matching
  // the created_at it inherited (see replaceGalleryPhoto in lib/adminEdit.ts).
  const replacePhotoLocally = useCallback((photoId: string, photo: GalleryPhoto) => {
    setPhotos((current) =>
      current.map((existing) => (existing.id === photoId ? photo : existing)),
    );
  }, []);

  return { photos, isLoading, removePhotoLocally, addPhotoLocally, replacePhotoLocally };
}
