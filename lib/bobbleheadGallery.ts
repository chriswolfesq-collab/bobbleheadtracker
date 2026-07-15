"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useBobbleheadGallery(teamSlug: string, bobbleheadId: string) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("bobblehead_gallery_photos")
      .select("image_url")
      .eq("team_slug", teamSlug)
      .eq("bobblehead_id", bobbleheadId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load gallery photos:", error.message);
          setPhotos([]);
        } else {
          setPhotos((data ?? []).map((row) => row.image_url));
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamSlug, bobbleheadId]);

  return { photos, isLoading };
}
