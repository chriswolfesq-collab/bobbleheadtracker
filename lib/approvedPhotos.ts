"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ApprovedPhotoMap = Record<string, string>;

// `seed` carries photo URLs already resolved on the server (see
// lib/curatedListing.ts) so the first client paint matches the server HTML.
// The effect still refetches the full team map to fill in the rest and pick up
// changes made this session.
export function useApprovedPhotos(teamSlug: string, seed?: ApprovedPhotoMap) {
  const [photoUrlById, setPhotoUrlById] = useState<ApprovedPhotoMap>(seed ?? {});
  const [isLoading, setIsLoading] = useState(!seed);

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
