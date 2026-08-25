"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAllApprovedPhotos } from "@/lib/approvedPhotos";
import { useAllGalleryPhotos } from "@/lib/bobbleheadGallery";
import { supabase } from "@/lib/supabase";

type PhotoMap = Record<string, string>;

type ResolvableListing = { id: string; teamSlug: string; imageUrl?: string | null };

// Curated ids ("hello-kitty-2019") repeat across teams, so a listing is only
// identified by the pair.
function listingKey(teamSlug: string, bobbleheadId: string): string {
  return `${teamSlug}/${bobbleheadId}`;
}

// A listing's photo doesn't have to live on the listing row. The first photo
// approved for a listing that had none is written to approved_photos, not to
// community_bobbleheads.image_url (approve_submission, supabase/team_reps.sql),
// and any after that land in the gallery — so a card reading only image_url
// shows the team placeholder forever for anything submitted photoless and
// photographed later.
//
// This resolves the same three layers the detail page does, in the same order,
// for a known handful of listings. The cross-team grids (search,
// /recently-added) fetch every approved photo because they filter across all of
// them; a ten-card strip needs ten, so both reads are scoped to the ids given.
export function useListingPhotos(listings: { id: string; teamSlug: string }[]) {
  const [approvedByKey, setApprovedByKey] = useState<PhotoMap>({});
  const [galleryByKey, setGalleryByKey] = useState<PhotoMap>({});

  // The listings array is rebuilt on every render of the caller, so the effect
  // keys off the ids themselves rather than the array's identity.
  const idsKey = useMemo(
    () => Array.from(new Set(listings.map((listing) => listing.id))).sort().join(" "),
    [listings],
  );

  useEffect(() => {
    if (!idsKey) return;

    let cancelled = false;
    const ids = idsKey.split(" ");

    supabase
      .from("approved_photos")
      .select("team_slug, bobblehead_id, image_url")
      .in("bobblehead_id", ids)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load approved photos:", error.message);
          return;
        }

        setApprovedByKey(
          Object.fromEntries(
            (data ?? []).map((row) => [listingKey(row.team_slug, row.bobblehead_id), row.image_url]),
          ),
        );
      });

    // Earliest photo per listing, matching the detail page's `galleryPhotos[0]`.
    supabase
      .from("bobblehead_gallery_photos")
      .select("team_slug, bobblehead_id, image_url")
      .in("bobblehead_id", ids)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load gallery photos:", error.message);
          return;
        }

        const byKey: PhotoMap = {};
        for (const row of data ?? []) {
          const key = listingKey(row.team_slug, row.bobblehead_id);
          if (!(key in byKey)) byKey[key] = row.image_url;
        }
        setGalleryByKey(byKey);
      });

    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return usePhotoResolver(approvedByKey, galleryByKey);
}

// The same three layers for a grid that spans every team and filters across all
// of it — search and /recently-added — where the set on screen changes with
// every keystroke and scoping the reads to it would mean refetching per
// keystroke. Both tables are small enough to read whole once.
export function useAllListingPhotos() {
  return usePhotoResolver(useAllApprovedPhotos(), useAllGalleryPhotos());
}

// Approved photo, then the listing's own, then its earliest gallery photo — the
// order of preference the listing page applies. An empty string counts as no
// photo rather than as a URL, matching the `||` chains the cards these feed
// have always used; a `??` chain would hand one straight to <img>.
function usePhotoResolver(approvedByKey: PhotoMap, galleryByKey: PhotoMap) {
  return useCallback(
    (listing: ResolvableListing): string | null => {
      const key = listingKey(listing.teamSlug, listing.id);
      return approvedByKey[key] || listing.imageUrl || galleryByKey[key] || null;
    },
    [approvedByKey, galleryByKey],
  );
}
