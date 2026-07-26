"use client";

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
