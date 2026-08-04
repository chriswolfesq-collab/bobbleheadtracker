"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import {
  type CollectionDetail,
  EMPTY_DETAIL,
  isCondition,
} from "@/lib/collectionDetails";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Row = {
  condition: string | null;
  acquired_on: string | null;
  price_paid: number | null;
  notes: string | null;
};

function toDetail(row: Row | null | undefined): CollectionDetail {
  if (!row) return EMPTY_DETAIL;
  return {
    // A condition the app doesn't recognize reads as "not recorded" rather than
    // being shown raw — the check constraint makes this near-impossible, but a
    // future value shouldn't render as `in_box_v2` in the middle of a sentence.
    condition: isCondition(row.condition) ? row.condition : null,
    acquiredOn: row.acquired_on,
    pricePaid: row.price_paid,
    notes: row.notes,
  };
}

// One bobblehead's details, loaded for the signed-in user and saved back in
// place. Deliberately not folded into useUserFlagMap's per-team map: details
// are read one listing at a time, and pulling four more columns for every row
// of a 100-listing team page to show them on one would be the wrong trade.
export function useCollectionDetail(teamSlug: string, bobbleheadId: string) {
  const { user } = useAuth();
  const { showError } = useToast();
  const [detail, setDetail] = useState<CollectionDetail>(EMPTY_DETAIL);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    // Scoped to the team as well as the id: a fan can own the same curated id on
    // two teams (see supabase/fix_collection_team_collisions.sql), and without
    // the team this reads whichever row comes back first — or, on a listing
    // owned twice, fails maybeSingle outright.
    supabase
      .from("user_collections")
      .select("condition, acquired_on, price_paid, notes")
      .eq("user_id", user.id)
      .eq("team_slug", teamSlug)
      .eq("bobblehead_id", bobbleheadId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load collection details:", error.message);
          setDetail(EMPTY_DETAIL);
        } else {
          setDetail(toDetail(data));
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, teamSlug, bobbleheadId]);

  // Upsert rather than update: the details form is only reachable once you own
  // the bobblehead, so the row is there in practice — but a row that somehow
  // isn't should end up saved rather than silently matching nothing, which is
  // what an update against a missing row does.
  //
  // Optimistic like the ownership toggles, and reverted the same way, so the
  // form can close on save instead of sitting on a spinner.
  const save = useCallback(
    async (next: CollectionDetail): Promise<boolean> => {
      if (!user) return false;

      const previous = detail;
      setDetail(next);

      const { error } = await supabase.from("user_collections").upsert(
        {
          user_id: user.id,
          bobblehead_id: bobbleheadId,
          team_slug: teamSlug,
          owned: true,
          condition: next.condition,
          acquired_on: next.acquiredOn,
          price_paid: next.pricePaid,
          notes: next.notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,team_slug,bobblehead_id" },
      );

      if (error) {
        console.error("Failed to save collection details:", error.message);
        setDetail(previous);
        showError("Couldn't save those details. Please try again.");
        return false;
      }

      return true;
    },
    [user, bobbleheadId, teamSlug, detail, showError],
  );

  return {
    detail: user ? detail : EMPTY_DETAIL,
    // With nobody logged in there's nothing to load.
    isLoading: user ? isLoading : false,
    save,
    isLoggedIn: Boolean(user),
  };
}
