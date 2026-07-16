"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type BobbleheadOverride = {
  title: string | null;
  year: string | null;
  date: string | null;
  deleted: boolean;
};

export function useBobbleheadOverride(teamSlug: string, bobbleheadId: string) {
  const [override, setOverride] = useState<BobbleheadOverride | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("bobblehead_overrides")
      .select("title, year, date, deleted")
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

export type DeletedBobbleheads = {
  isDeleted: (teamSlug: string, bobbleheadId: string) => boolean;
};

function deletedKey(teamSlug: string, bobbleheadId: string) {
  return `${teamSlug}/${bobbleheadId}`;
}

// Erring towards showing a listing rather than hiding one: if the lookup hasn't
// loaded (or failed), nothing is treated as deleted.
const NONE: DeletedBobbleheads = { isDeleted: () => false };

// Curated bobbleheads are hardcoded in lib/bobbleheads.ts, so an admin-deleted
// one is flagged in bobblehead_overrides rather than removed. Every list built
// from the hardcoded data has to filter against this. Community bobbleheads
// are really deleted and never show up here.
export async function fetchDeletedBobbleheads(): Promise<DeletedBobbleheads> {
  const { data, error } = await supabase
    .from("bobblehead_overrides")
    .select("team_slug, bobblehead_id")
    .eq("deleted", true);

  if (error) {
    console.error("Failed to load deleted bobbleheads:", error.message);
    return NONE;
  }

  const keys = new Set((data ?? []).map((row) => deletedKey(row.team_slug, row.bobblehead_id)));

  return { isDeleted: (teamSlug, bobbleheadId) => keys.has(deletedKey(teamSlug, bobbleheadId)) };
}

export function useDeletedBobbleheads(): DeletedBobbleheads {
  const [deleted, setDeleted] = useState<DeletedBobbleheads>(NONE);

  useEffect(() => {
    let cancelled = false;

    fetchDeletedBobbleheads().then((lookup) => {
      if (!cancelled) setDeleted(lookup);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return deleted;
}
