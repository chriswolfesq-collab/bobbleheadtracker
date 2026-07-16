"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type FavoritedMap = Record<string, boolean>;

export function useUserFavorites(teamSlug: string) {
  const { user } = useAuth();
  const { showError } = useToast();
  const [favoritedByIdRaw, setFavoritedByIdRaw] = useState<FavoritedMap>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    supabase
      .from("user_favorites")
      .select("bobblehead_id, favorited")
      .eq("user_id", user.id)
      .eq("team_slug", teamSlug)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your favorites:", error.message);
          setFavoritedByIdRaw({});
        } else {
          setFavoritedByIdRaw(
            Object.fromEntries((data ?? []).map((row) => [row.bobblehead_id, row.favorited])),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, teamSlug]);

  const favoritedById = user ? favoritedByIdRaw : {};

  const setFavorited = useCallback(
    async (bobbleheadId: string, favorited: boolean) => {
      if (!user) return;

      // Optimistic update; reverted below if the save fails.
      const previousFavorited = favoritedByIdRaw[bobbleheadId] ?? false;
      setFavoritedByIdRaw((current) => ({ ...current, [bobbleheadId]: favorited }));

      const { error } = await supabase.from("user_favorites").upsert({
        user_id: user.id,
        bobblehead_id: bobbleheadId,
        team_slug: teamSlug,
        favorited,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Failed to save favorite:", error.message);
        setFavoritedByIdRaw((current) => ({ ...current, [bobbleheadId]: previousFavorited }));
        showError("Couldn't save that favorite. Please try again.");
      }
    },
    [user, teamSlug, favoritedByIdRaw, showError],
  );

  return { favoritedById, isLoading: user ? isLoading : false, setFavorited, isLoggedIn: Boolean(user) };
}
