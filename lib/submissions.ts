"use client";

import type { User } from "@supabase/supabase-js";
import { approveSubmission, type ApprovableSubmission } from "@/lib/approveSubmission";
import { submissionError } from "@/lib/rateLimit";
import { supabase } from "@/lib/supabase";
import { storageKeyForFile } from "@/lib/storageKey";

export type SubmitResult = { autoApproved: boolean };

// An admin or team rep submitting for a team they manage doesn't need the review
// queue — approve their submission straight away so it goes live immediately.
// Authorization is the same server-side check the review page relies on:
// can_edit_team() gates the RPC below and is re-enforced inside approve_submission,
// so a submitter without rights simply falls back to a normal pending review.
async function maybeAutoApprove(submission: ApprovableSubmission): Promise<boolean> {
  const { data: canEdit, error } = await supabase.rpc("can_edit_team", {
    p_team_slug: submission.team_slug,
  });

  if (error || !canEdit) {
    return false;
  }

  try {
    await approveSubmission(submission);
    return true;
  } catch {
    // The submission row already exists as 'pending'; if auto-approval fails for
    // any reason it just stays in the review queue to be handled manually.
    return false;
  }
}

async function uploadPendingPhoto(user: User, file: File): Promise<string> {
  const path = storageKeyForFile(file.name, user.id);
  const { error } = await supabase.storage.from("bobblehead-pending").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

export async function submitPhotoForExisting({
  user,
  teamSlug,
  bobbleheadId,
  file,
}: {
  user: User;
  teamSlug: string;
  bobbleheadId: string;
  file: File;
}) {
  const storagePath = await uploadPendingPhoto(user, file);

  const { data, error } = await supabase
    .from("submissions")
    .insert({
      kind: "photo_for_existing",
      target_bobblehead_id: bobbleheadId,
      team_slug: teamSlug,
      storage_path: storagePath,
      submitted_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    throw submissionError(error);
  }

  const autoApproved = await maybeAutoApprove({
    id: data.id,
    kind: "photo_for_existing",
    target_bobblehead_id: bobbleheadId,
    team_slug: teamSlug,
    storage_path: storagePath,
  });

  return { autoApproved };
}

export async function submitNewBobblehead({
  user,
  teamSlug,
  title,
  nickname,
  quantity,
  date,
  file,
}: {
  user: User;
  teamSlug: string;
  title: string;
  nickname: string;
  quantity: string;
  date: string;
  file: File | null;
}) {
  const storagePath = file ? await uploadPendingPhoto(user, file) : null;

  const { data, error } = await supabase
    .from("submissions")
    .insert({
      kind: "new_bobblehead",
      team_slug: teamSlug,
      title,
      nickname: nickname.trim() || null,
      quantity: quantity.trim() || null,
      date: date || "N/A",
      storage_path: storagePath,
      submitted_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    throw submissionError(error);
  }

  const autoApproved = await maybeAutoApprove({
    id: data.id,
    kind: "new_bobblehead",
    target_bobblehead_id: null,
    team_slug: teamSlug,
    storage_path: storagePath,
  });

  return { autoApproved };
}
