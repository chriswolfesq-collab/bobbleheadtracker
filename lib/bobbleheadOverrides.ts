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

export type BobbleheadOverridesLookup = {
  isDeleted: (teamSlug: string, bobbleheadId: string) => boolean;
  getOverride: (teamSlug: string, bobbleheadId: string) => BobbleheadOverride | null;
};

function overrideKey(teamSlug: string, bobbleheadId: string) {
  return `${teamSlug}/${bobbleheadId}`;
}

// Erring towards showing a listing as-is: if the lookup hasn't loaded (or
// failed), nothing is treated as deleted or overridden.
const NONE: BobbleheadOverridesLookup = { isDeleted: () => false, getOverride: () => null };

// Curated bobbleheads are baked into the site at build time (see
// lib/bobbleheads.ts), so an admin edit or delete is recorded in
// bobblehead_overrides rather than in the data itself. Every list built from
// the curated data has to filter deletions and apply title/year/date
// overrides through this lookup. Community bobbleheads are real rows — edits
// and deletes happen in place and never show up here.
export async function fetchBobbleheadOverrides(): Promise<BobbleheadOverridesLookup> {
  const { data, error } = await supabase
    .from("bobblehead_overrides")
    .select("team_slug, bobblehead_id, title, year, date, deleted");

  if (error) {
    console.error("Failed to load bobblehead overrides:", error.message);
    return NONE;
  }

  const byKey = new Map(
    (data ?? []).map((row) => [
      overrideKey(row.team_slug, row.bobblehead_id),
      { title: row.title, year: row.year, date: row.date, deleted: row.deleted },
    ]),
  );

  return {
    isDeleted: (teamSlug, bobbleheadId) =>
      byKey.get(overrideKey(teamSlug, bobbleheadId))?.deleted ?? false,
    getOverride: (teamSlug, bobbleheadId) => byKey.get(overrideKey(teamSlug, bobbleheadId)) ?? null,
  };
}

export function useBobbleheadOverrides(): BobbleheadOverridesLookup {
  const [lookup, setLookup] = useState<BobbleheadOverridesLookup>(NONE);

  useEffect(() => {
    let cancelled = false;

    fetchBobbleheadOverrides().then((next) => {
      if (!cancelled) setLookup(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return lookup;
}
