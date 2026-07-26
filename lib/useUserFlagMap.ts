"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type FlagMap = Record<string, boolean>;

// The table and flag are chosen at runtime, which the generated per-table types
// can't express (each table has its own column union). This one query goes
// through an untyped view of the client; every static query keeps full typing.
const untyped = supabase as unknown as SupabaseClient;

// Shared implementation behind useUserCollection / useUserFavorites /
// useUserWanted. Each is a per-team map of bobblehead_id -> boolean for one flag
// column, with an optimistic setter that reverts and toasts on failure. The
// three differ only in which table/flag they read and the failure-toast copy.
export function useUserFlagMap(
  teamSlug: string,
  table: string,
  flag: string,
  errorMessage: string,
) {
  const { user } = useAuth();
  const { showError } = useToast();
  const [mapRaw, setMapRaw] = useState<FlagMap>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    // Widened to `string` so the Supabase client doesn't try to parse the
    // interpolated column list as a literal select expression.
    const columns: string = `bobblehead_id, ${flag}`;

    untyped
      .from(table)
      .select(columns)
      .eq("user_id", user.id)
      .eq("team_slug", teamSlug)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error(`Failed to load ${table}:`, error.message);
          setMapRaw({});
        } else {
          const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
          setMapRaw(
            Object.fromEntries(
              rows.map((row) => [String(row.bobblehead_id), Boolean(row[flag])]),
            ),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, teamSlug, table, flag]);

  const mapById = user ? mapRaw : {};

  const setFlag = useCallback(
    async (bobbleheadId: string, value: boolean) => {
      if (!user) return;

      // Optimistic update; reverted below if the save fails.
      const previous = mapRaw[bobbleheadId] ?? false;
      setMapRaw((current) => ({ ...current, [bobbleheadId]: value }));

      const { error } = await untyped.from(table).upsert({
        user_id: user.id,
        bobblehead_id: bobbleheadId,
        team_slug: teamSlug,
        [flag]: value,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error(`Failed to save ${flag}:`, error.message);
        setMapRaw((current) => ({ ...current, [bobbleheadId]: previous }));
        showError(errorMessage);
      }
    },
    [user, teamSlug, table, flag, errorMessage, mapRaw, showError],
  );

  return { mapById, isLoading: user ? isLoading : false, setFlag, isLoggedIn: Boolean(user) };
}
