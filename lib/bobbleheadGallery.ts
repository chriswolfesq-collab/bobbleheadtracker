"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// createdAt is carried so a replaced photo can keep the slot it was in — the
// gallery is ordered by it, and a replacement that took a fresh timestamp would
// jump to the end of the strip on the next load.
export type GalleryPhoto = { id: string; imageUrl: string; createdAt: string };

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
