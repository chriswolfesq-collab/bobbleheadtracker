"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useUserFlagMap } from "@/lib/useUserFlagMap";

// Per-team map of bobblehead_id -> owned, with an optimistic setter. Thin
// wrapper over the shared useUserFlagMap; see there for the mechanics.
export function useUserCollection(teamSlug: string) {
  const { mapById, isLoading, setFlag, isLoggedIn } = useUserFlagMap(
    teamSlug,
    "user_collections",
    "owned",
    "Couldn't save that ownership change. Please try again.",
  );

  return { ownedById: mapById, isLoading, setOwned: setFlag, isLoggedIn };
}

// Cross-team read-only lookup for pages that mix bobbleheads from many teams
// (recently added), keyed `${teamSlug}:${bobbleheadId}` like useMyWantedLookup.
export function useMyOwnedLookup() {
  const { user } = useAuth();
  const [ownedByKeyRaw, setOwnedByKeyRaw] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    supabase
      .from("user_collections")
      .select("bobblehead_id, team_slug, owned")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your collection:", error.message);
          setOwnedByKeyRaw({});
        } else {
          setOwnedByKeyRaw(
            Object.fromEntries(
              (data ?? []).map((row) => [`${row.team_slug}:${row.bobblehead_id}`, row.owned]),
            ),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return {
    ownedByKey: user ? ownedByKeyRaw : {},
    // With nobody logged in there's nothing to load.
    isLoading: user ? isLoading : false,
    isLoggedIn: Boolean(user),
  };
}
