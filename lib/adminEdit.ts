"use client";

import type { User } from "@supabase/supabase-js";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

async function uploadPhotoDirect(file: File): Promise<string> {
  const path = `${crypto.randomUUID()}-${file.name}`;

  const { error } = await supabase.storage.from("bobblehead-approved").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from("bobblehead-approved").getPublicUrl(path);

  return data.publicUrl;
}

async function savePhoto(user: User, teamSlug: string, bobbleheadId: string, file: File) {
  const imageUrl = await uploadPhotoDirect(file);

  const { error } = await supabase.from("approved_photos").upsert({
    bobblehead_id: bobbleheadId,
    team_slug: teamSlug,
    image_url: imageUrl,
    approved_by: user.id,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  return imageUrl;
}

export async function saveCuratedBobblehead({
  user,
  teamSlug,
  bobbleheadId,
  title,
  year,
  date,
  file,
}: {
  user: User;
  teamSlug: string;
  bobbleheadId: string;
  title: string;
  year: string;
  date: string;
  file?: File;
}) {
  const imageUrl = file ? await savePhoto(user, teamSlug, bobbleheadId, file) : null;

  const { error } = await supabase.from("bobblehead_overrides").upsert({
    team_slug: teamSlug,
    bobblehead_id: bobbleheadId,
    title,
    year,
    date,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  return { imageUrl };
}

function approvedStoragePathFromUrl(imageUrl: string): string | null {
  const marker = "/storage/v1/object/public/bobblehead-approved/";
  const index = imageUrl.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(imageUrl.slice(index + marker.length));
}

// Best-effort: photos uploaded before the admin-delete storage policy existed
// (or hosted off-Supabase, like curated seed photos) just leave no file to
// remove, and a failed removal shouldn't undo the DB delete the user asked for.
async function removeApprovedFile(imageUrl: string) {
  const path = approvedStoragePathFromUrl(imageUrl);
  if (path) {
    await supabase.storage.from("bobblehead-approved").remove([path]);
  }
}

export async function deleteGalleryPhoto(photo: { id: string; imageUrl: string }) {
  const { error } = await supabase.from("bobblehead_gallery_photos").delete().eq("id", photo.id);

  if (error) {
    throw new Error(error.message);
  }

  await removeApprovedFile(photo.imageUrl);
}

// Removes the listing's main photo: the approved_photos row (and, for a
// community listing, its own image_url column), so the page falls back to the
// curated seed image or the team placeholder.
export async function deleteMainPhoto({
  teamSlug,
  bobbleheadId,
  source,
  imageUrl,
}: {
  teamSlug: string;
  bobbleheadId: string;
  source: "curated" | "community";
  imageUrl: string | null;
}) {
  const { error } = await supabase
    .from("approved_photos")
    .delete()
    .eq("team_slug", teamSlug)
    .eq("bobblehead_id", bobbleheadId);

  if (error) {
    throw new Error(error.message);
  }

  if (source === "community") {
    const { error: communityError } = await supabase
      .from("community_bobbleheads")
      .update({ image_url: null })
      .eq("id", bobbleheadId);

    if (communityError) {
      throw new Error(communityError.message);
    }
  }

  if (imageUrl) {
    await removeApprovedFile(imageUrl);
  }
}

// Deletes the listing and everything attached to it (photos, gallery,
// ownership, favorites, reports). Irreversible from the UI: a deleted curated
// listing can only come back by clearing its `deleted` flag in the SQL editor.
export async function deleteBobblehead({
  teamSlug,
  bobbleheadId,
  source,
}: {
  teamSlug: string;
  bobbleheadId: string;
  source: "curated" | "community";
}) {
  const { error } = await supabase.rpc("admin_delete_bobblehead", {
    p_team_slug: teamSlug,
    p_bobblehead_id: bobbleheadId,
    p_source: source,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function saveCommunityBobblehead({
  user,
  teamSlug,
  bobbleheadId,
  title,
  year,
  date,
  file,
}: {
  user: User;
  teamSlug: string;
  bobbleheadId: string;
  title: string;
  year: string;
  date: string;
  file?: File;
}) {
  const imageUrl = file ? await savePhoto(user, teamSlug, bobbleheadId, file) : null;

  const { error } = await supabase
    .from("community_bobbleheads")
    .update({ title, year, date })
    .eq("id", bobbleheadId);

  if (error) {
    throw new Error(error.message);
  }

  return { imageUrl };
}
