"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type WantedMap = Record<string, boolean>;

export function useUserWanted(teamSlug: string) {
  const { user } = useAuth();
  const { showError } = useToast();
  const [wantedByIdRaw, setWantedByIdRaw] = useState<WantedMap>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    supabase
      .from("user_wants")
      .select("bobblehead_id, wanted")
      .eq("user_id", user.id)
      .eq("team_slug", teamSlug)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your wanted list:", error.message);
          setWantedByIdRaw({});
        } else {
          setWantedByIdRaw(
            Object.fromEntries((data ?? []).map((row) => [row.bobblehead_id, row.wanted])),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, teamSlug]);

  const wantedById = user ? wantedByIdRaw : {};

  const setWanted = useCallback(
    async (bobbleheadId: string, wanted: boolean) => {
      if (!user) return;

      // Optimistic update; reverted below if the save fails.
      const previousWanted = wantedByIdRaw[bobbleheadId] ?? false;
      setWantedByIdRaw((current) => ({ ...current, [bobbleheadId]: wanted }));

      const { error } = await supabase.from("user_wants").upsert({
        user_id: user.id,
        bobblehead_id: bobbleheadId,
        team_slug: teamSlug,
        wanted,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Failed to save wanted status:", error.message);
        setWantedByIdRaw((current) => ({ ...current, [bobbleheadId]: previousWanted }));
        showError("Couldn't save that. Please try again.");
      }
    },
    [user, teamSlug, wantedByIdRaw, showError],
  );

  return { wantedById, isLoading: user ? isLoading : false, setWanted, isLoggedIn: Boolean(user) };
}

// Cross-team variant for pages that mix bobbleheads from many teams (recently
// added), where calling useUserWanted(teamSlug) per card would fire one query
// per team on screen. Keyed by `${teamSlug}:${bobbleheadId}` since ids aren't
// guaranteed unique across teams.
export function useMyWantedLookup() {
  const { user } = useAuth();
  const { showError } = useToast();
  const [wantedByKeyRaw, setWantedByKeyRaw] = useState<WantedMap>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    supabase
      .from("user_wants")
      .select("bobblehead_id, team_slug, wanted")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your wanted list:", error.message);
          setWantedByKeyRaw({});
        } else {
          setWantedByKeyRaw(
            Object.fromEntries(
              (data ?? []).map((row) => [`${row.team_slug}:${row.bobblehead_id}`, row.wanted]),
            ),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const wantedByKey = user ? wantedByKeyRaw : {};

  const setWanted = useCallback(
    async (teamSlug: string, bobbleheadId: string, wanted: boolean) => {
      if (!user) return;

      const key = `${teamSlug}:${bobbleheadId}`;
      const previousWanted = wantedByKeyRaw[key] ?? false;
      setWantedByKeyRaw((current) => ({ ...current, [key]: wanted }));

      const { error } = await supabase.from("user_wants").upsert({
        user_id: user.id,
        bobblehead_id: bobbleheadId,
        team_slug: teamSlug,
        wanted,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Failed to save wanted status:", error.message);
        setWantedByKeyRaw((current) => ({ ...current, [key]: previousWanted }));
        showError("Couldn't save that. Please try again.");
      }
    },
    [user, wantedByKeyRaw, showError],
  );

  return { wantedByKey, isLoading: user ? isLoading : false, setWanted, isLoggedIn: Boolean(user) };
}
