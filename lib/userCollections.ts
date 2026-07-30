"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
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

// Cross-team lookup for pages that mix bobbleheads from many teams (recently
// added), keyed `${teamSlug}:${bobbleheadId}` like useMyWantedLookup. Those
// pages mostly read it to filter, but they also need to be able to clear
// ownership: marking something wanted has to take it off your shelf, the same
// way it does on a team page or a listing.
export function useMyOwnedLookup() {
  const { user } = useAuth();
  const { showError } = useToast();
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

  // Optimistic, reverting and toasting on failure — the same contract as
  // useMyWantedLookup's setter next door.
  const setOwned = useCallback(
    async (teamSlug: string, bobbleheadId: string, owned: boolean) => {
      if (!user) return;

      const key = `${teamSlug}:${bobbleheadId}`;
      const previousOwned = ownedByKeyRaw[key] ?? false;
      setOwnedByKeyRaw((current) => ({ ...current, [key]: owned }));

      const { error } = await supabase.from("user_collections").upsert({
        user_id: user.id,
        bobblehead_id: bobbleheadId,
        team_slug: teamSlug,
        owned,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Failed to save ownership status:", error.message);
        setOwnedByKeyRaw((current) => ({ ...current, [key]: previousOwned }));
        showError("Couldn't save that ownership change. Please try again.");
      }
    },
    [user, ownedByKeyRaw, showError],
  );

  return {
    ownedByKey: user ? ownedByKeyRaw : {},
    // With nobody logged in there's nothing to load.
    isLoading: user ? isLoading : false,
    setOwned,
    isLoggedIn: Boolean(user),
  };
}
