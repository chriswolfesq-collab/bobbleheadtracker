"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { submissionError } from "@/lib/rateLimit";
import { validateTagLabel } from "@/lib/tags";

// The request half of the admin-curated vocabulary. Nobody but the admin can
// write to tags or bobblehead_tags (see supabase/tag_requests.sql); what any
// signed-in user can do is file a request, which the admin approves or rejects
// from /admin/tag-requests. Approving does what the rep's picker used to do —
// mint-if-new, then apply — under the admin's own credentials.

export type TagRequestSource = "curated" | "community";

export type TagRequest = {
  id: string;
  label: string;
  slug: string;
  bobblehead_id: string;
  team_slug: string;
  source: TagRequestSource;
  requested_by: string;
  created_at: string;
};

export type TagRequestResult = { error: string | null };

// Same guard as lib/adminTags.ts: RLS filters a forbidden write to zero rows
// and reports success, so every ruling asks for its row back.
function notPersisted(subject: string): string {
  return `${subject} wasn't saved — your admin access may have expired. Sign out and back in, then try again.`;
}

/** Files a request. `alreadyRequested` is the double-ask case (the partial
 * unique index in tag_requests.sql), which the caller can treat as success. */
export async function submitTagRequest(
  client: SupabaseClient,
  input: {
    label: string;
    bobbleheadId: string;
    teamSlug: string;
    source: TagRequestSource;
    requestedBy: string;
  },
): Promise<TagRequestResult & { slug?: string; label?: string; alreadyRequested?: boolean }> {
  const validated = validateTagLabel(input.label);
  if ("error" in validated) return { error: validated.error };

  const { error } = await client.from("tag_requests").insert({
    label: validated.label,
    slug: validated.slug,
    bobblehead_id: input.bobbleheadId,
    team_slug: input.teamSlug,
    source: input.source,
    requested_by: input.requestedBy,
  });

  if (error) {
    // 23505 is the pending-unique index: this exact ask is already in the
    // queue, which from the requester's side is the outcome they wanted.
    if (error.code === "23505") {
      return { error: null, slug: validated.slug, label: validated.label, alreadyRequested: true };
    }
    // Anything else, including the BB429 the rate-limit trigger raises, gets
    // the same friendly rewrite the other public write paths use.
    return { error: submissionError(error).message };
  }

  return { error: null, slug: validated.slug, label: validated.label };
}

/**
 * Approve: mint the tag if it's new (keeping an existing label's casing, same
 * as the picker always has), apply it to the listing, then mark the request.
 * The request row keeps the requester's credit — created_by on the tag rows is
 * the admin, because that's whose authority put it in the vocabulary.
 */
export async function approveTagRequest(
  client: SupabaseClient,
  request: TagRequest,
  adminId: string,
): Promise<TagRequestResult> {
  const validated = validateTagLabel(request.label);
  if ("error" in validated) return { error: validated.error };

  const { error: vocabularyError } = await client
    .from("tags")
    .upsert(
      { slug: validated.slug, label: validated.label, created_by: adminId },
      { onConflict: "slug", ignoreDuplicates: true },
    );
  if (vocabularyError) return { error: vocabularyError.message };

  // Upsert, not insert: the tag may have landed on the listing some other way
  // between the request and the ruling, and that shouldn't fail the approval.
  const { error: applyError } = await client.from("bobblehead_tags").upsert(
    {
      bobblehead_id: request.bobblehead_id,
      team_slug: request.team_slug,
      tag_slug: validated.slug,
      created_by: adminId,
    },
    // The key is (bobblehead_id, team_slug, tag_slug) — widened in 60272ea so
    // two teams can carry the same tag on the same bobblehead id. Naming the
    // old two-column key here made Postgres reject the whole approval.
    { onConflict: "bobblehead_id,team_slug,tag_slug", ignoreDuplicates: true },
  );
  if (applyError) return { error: applyError.message };

  return settleRequest(client, request.id, "approved");
}

export async function rejectTagRequest(
  client: SupabaseClient,
  requestId: string,
): Promise<TagRequestResult> {
  return settleRequest(client, requestId, "rejected");
}

async function settleRequest(
  client: SupabaseClient,
  requestId: string,
  status: "approved" | "rejected",
): Promise<TagRequestResult> {
  const { data, error } = await client
    .from("tag_requests")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: notPersisted("The ruling") };

  return { error: null };
}
