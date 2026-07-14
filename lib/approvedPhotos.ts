"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ApprovedPhotoMap = Record<string, string>;

export function useApprovedPhotos(teamSlug: string) {
  const [photoUrlById, setPhotoUrlById] = useState<ApprovedPhotoMap>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("approved_photos")
      .select("bobblehead_id, image_url")
      .eq("team_slug", teamSlug)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load approved photos:", error.message);
          setPhotoUrlById({});
        } else {
          setPhotoUrlById(
            Object.fromEntries((data ?? []).map((row) => [row.bobblehead_id, row.image_url])),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamSlug]);

  return { photoUrlById, isLoading };
}
