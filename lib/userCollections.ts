"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type OwnedMap = Record<string, boolean>;

export function useUserCollection(teamSlug: string) {
  const { user } = useAuth();
  const [ownedByIdRaw, setOwnedByIdRaw] = useState<OwnedMap>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    supabase
      .from("user_collections")
      .select("bobblehead_id, owned")
      .eq("user_id", user.id)
      .eq("team_slug", teamSlug)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your collection:", error.message);
          setOwnedByIdRaw({});
        } else {
          setOwnedByIdRaw(
            Object.fromEntries((data ?? []).map((row) => [row.bobblehead_id, row.owned])),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, teamSlug]);

  const ownedById = user ? ownedByIdRaw : {};

  const setOwned = useCallback(
    async (bobbleheadId: string, owned: boolean) => {
      if (!user) return;

      setOwnedByIdRaw((current) => ({ ...current, [bobbleheadId]: owned }));

      const { error } = await supabase.from("user_collections").upsert({
        user_id: user.id,
        bobblehead_id: bobbleheadId,
        team_slug: teamSlug,
        owned,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Failed to save ownership:", error.message);
      }
    },
    [user, teamSlug],
  );

  return { ownedById, isLoading: user ? isLoading : false, setOwned, isLoggedIn: Boolean(user) };
}
