"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ApprovedPhotoMap = Record<string, string>;

// Every team's approved photos at once, keyed by "team_slug/bobblehead_id" —
// curated ids ("hello-kitty-2019") repeat across teams, so the bare id is
// ambiguous. Behind the cross-team grids (search, /recently-added), whose rows
// span all teams — the curated build-time data mostly has no imageUrl of its
// own, so without this those results are all placeholders. Read through
// useAllListingPhotos (lib/listingPhotos.ts), which layers the gallery under it.
export function useAllApprovedPhotos() {
  const [photoUrlByListing, setPhotoUrlByListing] = useState<ApprovedPhotoMap>({});

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("approved_photos")
      .select("team_slug, bobblehead_id, image_url")
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load approved photos:", error.message);
          return;
        }

        setPhotoUrlByListing(
          Object.fromEntries(
            (data ?? []).map((row) => [`${row.team_slug}/${row.bobblehead_id}`, row.image_url]),
          ),
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return photoUrlByListing;
}

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
