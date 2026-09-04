"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Who reps one team — see supabase/team_rep_list.sql. Reps are keyed by email,
// which lives in auth.users and never comes back from the RPC; what does is the
// same name/slug/avatar trio member search returns.
//
// One team per call by design. There is no site-wide roster to fetch, so
// nothing here can accumulate one.

export type TeamRep = {
  displayName: string;
  /** Their shelf handle — /shelf/<slug>. Never null: the RPC drops rows without one. */
  slug: string;
  avatarPath: string | null;
};

export function useTeamReps(teamSlug: string) {
  const [reps, setReps] = useState<TeamRep[]>([]);
  // Starts true so the card can stay off screen until the answer is in, rather
  // than flashing "no rep yet" at every reader on every team page.
  const [isLoading, setIsLoading] = useState(true);

  // State is only ever set inside the async .then, never synchronously in the
  // effect body — the same shape as the admin reps console, and what keeps this
  // off the cascading-render path.
  useEffect(() => {
    let cancelled = false;

    supabase.rpc("get_team_reps", { p_team_slug: teamSlug }).then(({ data, error }) => {
      if (cancelled) return;

      if (error) {
        // Nobody's page should break over this: the card simply doesn't render.
        console.error("Failed to load team reps:", error.message);
        setReps([]);
      } else {
        setReps(
          (data ?? []).map((row) => ({
            displayName: row.display_name,
            slug: row.slug,
            avatarPath: row.avatar_path,
          })),
        );
      }

      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [teamSlug]);

  return { reps, isLoading };
}
