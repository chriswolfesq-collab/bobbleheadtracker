import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";
import { supabase } from "@/lib/supabase";

// The subset of a submission the approval path actually needs. Both the admin
// review queue (which holds a richer ReviewRow) and the submit path (which only
// has the freshly-inserted row's id plus what it just wrote) satisfy this.
export type ApprovableSubmission = {
  id: string;
  kind: "photo_for_existing" | "new_bobblehead";
  target_bobblehead_id: string | null;
  team_slug: string;
  storage_path: string | null;
};

async function moveToApproved(storagePath: string, submissionId: string) {
  const { data: file, error: downloadError } = await supabase.storage
    .from("bobblehead-pending")
    .download(storagePath);

  if (downloadError || !file) {
    throw new Error(downloadError?.message ?? "Could not read the submitted photo.");
  }

  const filename = storagePath.split("/").pop() ?? "photo";
  const approvedPath = `${submissionId}-${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("bobblehead-approved")
    .upload(approvedPath, file, { upsert: true });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage.from("bobblehead-approved").getPublicUrl(approvedPath);

  return { publicUrl: publicUrlData.publicUrl, approvedPath };
}

// approve_submission() decides main-photo-vs-gallery inside the transaction;
// the only photo source the database can't see is the curated seed photo in
// the build-time data, so that one static fact is passed along.
function curatedHasSeedPhoto(teamSlug: string, bobbleheadId: string): boolean {
  const curated = GIVEAWAYS_BY_TEAM[teamSlug]?.find((giveaway) => giveaway.id === bobbleheadId);
  return Boolean(curated?.imageUrl);
}

// Core approve work, throwing on failure so it can be reused by the admin review
// handlers (single-row and bulk) and by the submit path's auto-approval. Touches
// no component state. Authorization is enforced inside approve_submission() via
// can_edit_team(), so calling this for a submitter who lacks rights fails cleanly.
export async function approveSubmission(submission: ApprovableSubmission) {
  // A new_bobblehead submission can arrive without a photo; there's then nothing
  // to move into the approved bucket and the listing is created photoless.
  const moved = submission.storage_path
    ? await moveToApproved(submission.storage_path, submission.id)
    : null;
  const curatedHasPhoto =
    submission.kind === "photo_for_existing" && submission.target_bobblehead_id
      ? curatedHasSeedPhoto(submission.team_slug, submission.target_bobblehead_id)
      : false;

  const { error: rpcError } = await supabase.rpc("approve_submission", {
    p_submission_id: submission.id,
    p_image_url: moved?.publicUrl ?? null,
    p_curated_has_photo: curatedHasPhoto,
  });

  if (rpcError) {
    // The copy made by moveToApproved is orphaned if the approval didn't go
    // through — best-effort cleanup, keeping the original error.
    if (moved) {
      await supabase.storage
        .from("bobblehead-approved")
        .remove([moved.approvedPath])
        .catch(() => undefined);
    }
    throw new Error(rpcError.message);
  }

  if (submission.storage_path) {
    await supabase.storage.from("bobblehead-pending").remove([submission.storage_path]);
  }
}
