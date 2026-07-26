"use client";

import { useUserFlagMap } from "@/lib/useUserFlagMap";

// Per-team map of bobblehead_id -> favorited, with an optimistic setter. Thin
// wrapper over the shared useUserFlagMap; see there for the mechanics.
export function useUserFavorites(teamSlug: string) {
  const { mapById, isLoading, setFlag, isLoggedIn } = useUserFlagMap(
    teamSlug,
    "user_favorites",
    "favorited",
    "Couldn't save that favorite. Please try again.",
  );

  return { favoritedById: mapById, isLoading, setFavorited: setFlag, isLoggedIn };
}
