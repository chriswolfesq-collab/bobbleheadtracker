"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type BobbleheadOverride = {
  title: string | null;
  nickname: string | null;
  quantity: string | null;
  year: string | null;
  date: string | null;
  /** Athletics only: "Oakland" or "Sacramento". See lib/athleticsCity.ts. */
  city: string | null;
  deleted: boolean;
  // Curated listings carry a seed photo in data/giveaways/*.json that isn't a
  // DB row, so removing it is recorded here rather than by deleting anything.
  photoHidden: boolean;
};

// `seed` carries the override already resolved on the server (see
// lib/curatedListing.ts). When present, the hook renders it immediately so the
// first client paint matches the server HTML — no loading flicker, no
// hydration mismatch — then still refetches to pick up edits made this session.
export function useBobbleheadOverride(
  teamSlug: string,
  bobbleheadId: string,
  seed?: { override: BobbleheadOverride | null },
) {
  const [override, setOverride] = useState<BobbleheadOverride | null>(seed?.override ?? null);
  const [isLoading, setIsLoading] = useState(!seed);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("bobblehead_overrides")
      .select("title, nickname, quantity, year, date, city, deleted, photo_hidden")
      .eq("team_slug", teamSlug)
      .eq("bobblehead_id", bobbleheadId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load bobblehead override:", error.message);
          setOverride(null);
        } else {
          setOverride(
            data
              ? {
                  title: data.title,
                  nickname: data.nickname,
                  quantity: data.quantity,
                  year: data.year,
                  date: data.date,
                  city: data.city,
                  deleted: data.deleted,
                  photoHidden: data.photo_hidden,
                }
              : null,
          );
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
  /**
   * False until the fetch has landed — and after one that failed. A caller
   * holding a server-rendered list (the team page) keeps showing it rather than
   * rebuilding one from a lookup that would report nothing as edited or deleted.
   */
  isLoaded: boolean;
};

function overrideKey(teamSlug: string, bobbleheadId: string) {
  return `${teamSlug}/${bobbleheadId}`;
}

// Erring towards showing a listing as-is: if the lookup hasn't loaded (or
// failed), nothing is treated as deleted or overridden.
const NONE: BobbleheadOverridesLookup = {
  isDeleted: () => false,
  getOverride: () => null,
  isLoaded: false,
};

// Curated bobbleheads are baked into the site at build time (see
// lib/bobbleheads.ts), so an admin edit or delete is recorded in
// bobblehead_overrides rather than in the data itself. Every list built from
// the curated data has to filter deletions and apply title/year/date
// overrides through this lookup. Community bobbleheads are real rows — edits
// and deletes happen in place and never show up here.
export async function fetchBobbleheadOverrides(): Promise<BobbleheadOverridesLookup> {
  const { data, error } = await supabase
    .from("bobblehead_overrides")
    .select("team_slug, bobblehead_id, title, nickname, quantity, year, date, city, deleted, photo_hidden");

  if (error) {
    console.error("Failed to load bobblehead overrides:", error.message);
    return NONE;
  }

  const byKey = new Map(
    (data ?? []).map((row) => [
      overrideKey(row.team_slug, row.bobblehead_id),
      {
        title: row.title,
        nickname: row.nickname,
        quantity: row.quantity,
        year: row.year,
        date: row.date,
        city: row.city,
        deleted: row.deleted,
        photoHidden: row.photo_hidden,
      },
    ]),
  );

  return {
    isDeleted: (teamSlug, bobbleheadId) =>
      byKey.get(overrideKey(teamSlug, bobbleheadId))?.deleted ?? false,
    getOverride: (teamSlug, bobbleheadId) => byKey.get(overrideKey(teamSlug, bobbleheadId)) ?? null,
    isLoaded: true,
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
