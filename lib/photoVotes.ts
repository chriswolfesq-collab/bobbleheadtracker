"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { submissionError } from "@/lib/rateLimit";
import { supabase } from "@/lib/supabase";

// Photo voting for one listing — see supabase/photo_votes.sql for the model.
// One vote per member per listing, keyed by photo URL (the only identity every
// photo layer shares). Everything goes through RPCs: tallies are public but
// who-voted-what is not, and every write has to run the promotion check.

export type PhotoVotesState = {
  /** URL -> vote count for this listing. Missing URL = zero votes. */
  votesByUrl: Record<string, number>;
  /** The signed-in member's current pick, or null. */
  myVoteUrl: string | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  /** Vote for a photo; voting for your current pick retracts it. */
  toggleVote: (imageUrl: string) => void;
};

export function usePhotoVotes(teamSlug: string, bobbleheadId: string): PhotoVotesState {
  const { user } = useAuth();
  const { showError } = useToast();
  const [votesByUrl, setVotesByUrl] = useState<Record<string, number>>({});
  const [myVoteUrl, setMyVoteUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .rpc("get_photo_votes", { p_team_slug: teamSlug, p_bobblehead_id: bobbleheadId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load photo votes:", error.message);
        } else {
          const rows = data ?? [];
          setVotesByUrl(Object.fromEntries(rows.map((row) => [row.image_url, row.votes])));
          setMyVoteUrl(rows.find((row) => row.my_vote)?.image_url ?? null);
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // user in the deps: my_vote comes back per-session, so signing in (or out)
    // through the modal has to refresh what "my vote" means.
  }, [teamSlug, bobbleheadId, user]);

  const toggleVote = useCallback(
    (imageUrl: string) => {
      if (!user) return;

      // Optimistic: move the vote locally, revert-and-toast if the save fails
      // (the useUserFlagMap pattern). One member has one vote, so a switch
      // decrements the old pick and increments the new one.
      const previousVotes = votesByUrl;
      const previousMine = myVoteUrl;
      const retracting = myVoteUrl === imageUrl;

      const next = { ...votesByUrl };
      if (previousMine) next[previousMine] = Math.max(0, (next[previousMine] ?? 1) - 1);
      if (!retracting) next[imageUrl] = (next[imageUrl] ?? 0) + 1;
      setVotesByUrl(next);
      setMyVoteUrl(retracting ? null : imageUrl);

      const call = retracting
        ? supabase.rpc("retract_photo_vote", {
            p_team_slug: teamSlug,
            p_bobblehead_id: bobbleheadId,
          })
        : supabase.rpc("cast_photo_vote", {
            p_team_slug: teamSlug,
            p_bobblehead_id: bobbleheadId,
            p_image_url: imageUrl,
          });

      call.then(({ error }) => {
        if (!error) return;
        setVotesByUrl(previousVotes);
        setMyVoteUrl(previousMine);
        showError(submissionError(error).message);
      });
    },
    [user, teamSlug, bobbleheadId, votesByUrl, myVoteUrl, showError],
  );

  return { votesByUrl, myVoteUrl, isLoading, isLoggedIn: Boolean(user), toggleVote };
}
