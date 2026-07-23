"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type GalleryPhoto = { id: string; imageUrl: string };

export function useBobbleheadGallery(teamSlug: string, bobbleheadId: string) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("bobblehead_gallery_photos")
      .select("id, image_url")
      .eq("team_slug", teamSlug)
      .eq("bobblehead_id", bobbleheadId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load gallery photos:", error.message);
          setPhotos([]);
        } else {
          setPhotos((data ?? []).map((row) => ({ id: row.id, imageUrl: row.image_url })));
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

  return { photos, isLoading, removePhotoLocally, addPhotoLocally };
}
