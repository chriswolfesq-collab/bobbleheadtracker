"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { submissionError } from "@/lib/rateLimit";
import { supabase } from "@/lib/supabase";

// Description edit requests — see supabase/description_edits.sql. Any member
// proposes; whoever can edit the listing (team rep or admin) publishes.
// Approval is the same client-side two-step tag requests use: write the
// outcome under the reviewer's own RLS rights, then settle the request row —
// the write targets bobblehead_overrides / community_bobbleheads, whose
// revalidate triggers rebuild the prerendered page for free.

export type DescriptionEditRequest = {
  id: string;
  bobblehead_id: string;
  team_slug: string;
  source: "curated" | "community";
  proposed: string;
  requested_by: string;
  created_at: string;
};

export const MAX_DESCRIPTION_LENGTH = 2000;
export const MIN_DESCRIPTION_LENGTH = 10;

// Same guard as lib/adminEdit.ts: RLS filters a forbidden write to zero rows
// and reports success, so every ruling asks for its row back.
function notPersisted(subject: string): string {
  return `${subject} wasn't saved — your access may have expired. Sign out and back in, then try again.`;
}

/** Files a suggestion. `alreadyPending` is the one-open-ask-per-listing index
 *  firing — the proposer already has an edit waiting on this listing. */
export async function submitDescriptionEdit(input: {
  bobbleheadId: string;
  teamSlug: string;
  source: "curated" | "community";
  proposed: string;
  requestedBy: string;
}): Promise<{ error: string | null; alreadyPending?: boolean }> {
  const proposed = input.proposed.trim();
  if (proposed.length < MIN_DESCRIPTION_LENGTH) {
    return { error: "Say a little more — at least a sentence." };
  }
  if (proposed.length > MAX_DESCRIPTION_LENGTH) {
    return { error: `Keep it under ${MAX_DESCRIPTION_LENGTH} characters.` };
  }

  const { error } = await supabase.from("description_edit_requests").insert({
    bobblehead_id: input.bobbleheadId,
    team_slug: input.teamSlug,
    source: input.source,
    proposed,
    requested_by: input.requestedBy,
  });

  if (error) {
    // 23505 is the pending-unique index: one open suggestion per listing per
    // person. Not an error so much as "yours is still in the queue".
    if (error.code === "23505") return { error: null, alreadyPending: true };
    return { error: submissionError(error).message };
  }

  return { error: null };
}

/**
 * Approve: publish the proposed text onto the listing, then settle the
 * request. Curated listings store it on their override row (upsert — the PK
 * is (team_slug, bobblehead_id), and on conflict only the named columns
 * change, so an existing override's title/date edits survive); community
 * listings carry it on their own row.
 */
export async function approveDescriptionEdit(
  request: DescriptionEditRequest,
  reviewerId: string,
): Promise<{ error: string | null }> {
  if (request.source === "curated") {
    const { data, error } = await supabase
      .from("bobblehead_overrides")
      .upsert({
        team_slug: request.team_slug,
        bobblehead_id: request.bobblehead_id,
        description: request.proposed,
        updated_by: reviewerId,
        updated_at: new Date().toISOString(),
      })
      .select("bobblehead_id");
    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: notPersisted("The description") };
  } else {
    const { data, error } = await supabase
      .from("community_bobbleheads")
      .update({ description: request.proposed })
      .eq("id", request.bobblehead_id)
      .select("id");
    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: notPersisted("The description") };
  }

  return settleRequest(request.id, "approved");
}

export async function rejectDescriptionEdit(requestId: string): Promise<{ error: string | null }> {
  return settleRequest(requestId, "rejected");
}

async function settleRequest(
  requestId: string,
  status: "approved" | "rejected",
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from("description_edit_requests")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: notPersisted("The ruling") };

  return { error: null };
}

/**
 * Whether the signed-in member already has a pending suggestion on this
 * listing — the button then shows "pending review" instead of asking again.
 * `markPending` flips it locally right after a successful submit.
 */
export function useMyPendingDescriptionEdit(teamSlug: string, bobbleheadId: string) {
  const { user } = useAuth();
  const [fetchedPending, setFetchedPending] = useState(false);
  const [localPending, setLocalPending] = useState(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    supabase
      .from("description_edit_requests")
      .select("id", { count: "exact", head: true })
      .eq("team_slug", teamSlug)
      .eq("bobblehead_id", bobbleheadId)
      .eq("requested_by", user.id)
      .eq("status", "pending")
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to check pending description edit:", error.message);
          return;
        }
        setFetchedPending((count ?? 0) > 0);
      });

    return () => {
      cancelled = true;
    };
  }, [user, teamSlug, bobbleheadId]);

  return {
    isPending: Boolean(user) && (fetchedPending || localPending),
    markPending: () => setLocalPending(true),
  };
}
