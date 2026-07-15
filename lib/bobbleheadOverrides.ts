"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type BobbleheadOverride = {
  title: string | null;
  year: string | null;
  date: string | null;
};

export function useBobbleheadOverride(teamSlug: string, bobbleheadId: string) {
  const [override, setOverride] = useState<BobbleheadOverride | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("bobblehead_overrides")
      .select("title, year, date")
      .eq("team_slug", teamSlug)
      .eq("bobblehead_id", bobbleheadId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load bobblehead override:", error.message);
          setOverride(null);
        } else {
          setOverride(data ?? null);
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamSlug, bobbleheadId]);

  return { override, isLoading };
}
