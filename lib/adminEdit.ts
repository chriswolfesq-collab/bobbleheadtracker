"use client";

import type { User } from "@supabase/supabase-js";
import type { GalleryPhoto } from "@/lib/bobbleheadGallery";
import type { RarityTier } from "@/lib/rarity";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { storageKeyForFile } from "@/lib/storageKey";

// A write that returns no error but touches zero rows was silently filtered by
// row-level security, or it targeted a row that no longer exists. Either way
// the change did NOT persist. Supabase reports success (error: null, HTTP 200)
// for this, so without an explicit row-count check the UI closes the dialog as
// if the edit took. We turn it into a visible, actionable error instead. Relies
// on every target table having a public SELECT policy, so the returned rows
// reflect exactly what was written.
//
// The message names both ways can_edit_team() can come back false, because they
// need opposite fixes and the caller can't tell them apart from here: an expired
// session (sign back in) or an account that never had rights to this row's team
// (an admin has to grant them). Naming only the session sent a team rep who hit
// the second case round and round a re-login that could never work.
function assertPersisted<T>(rows: T[] | null, subject: string): void {
  if (!rows || rows.length === 0) {
    throw new Error(
      `${subject} wasn't saved — you may not have edit access for this team, or your session expired. ` +
        `Sign out and back in; if that doesn't help, ask an admin to check your team access.`,
    );
  }
}

async function uploadPhotoDirect(file: File): Promise<string> {
  const path = storageKeyForFile(file.name);

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

  // Conflict target must include team_slug: curated ids ("spider-man-2019")
  // repeat across teams, and a bare-id upsert would try to update another
  // team's row — which RLS then filters to zero rows.
  const { data, error } = await supabase
    .from("approved_photos")
    .upsert(
      {
        bobblehead_id: bobbleheadId,
        team_slug: teamSlug,
        image_url: imageUrl,
        approved_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_slug,bobblehead_id" },
    )
    .select();

  if (error) {
    throw new Error(error.message);
  }

  assertPersisted(data, "The photo");

  return imageUrl;
}

export async function saveCuratedBobblehead({
  user,
  teamSlug,
  bobbleheadId,
  title,
  nickname,
  quantity,
  year,
  date,
  city,
  rarity,
  rarityNote,
  file,
}: {
  user: User;
  teamSlug: string;
  bobbleheadId: string;
  title: string;
  nickname: string;
  quantity: string;
  year: string;
  date: string;
  /** Athletics only; null on every other team. See lib/athleticsCity.ts. */
  city?: string | null;
  /** Hand-set badge; null clears it. Nothing derives it. See lib/rarity.ts. */
  rarity?: RarityTier | null;
  rarityNote?: string;
  file?: File;
}) {
  const imageUrl = file ? await savePhoto(user, teamSlug, bobbleheadId, file) : null;

  const { data, error } = await supabase
    .from("bobblehead_overrides")
    .upsert({
      team_slug: teamSlug,
      bobblehead_id: bobbleheadId,
      title,
      nickname: nickname.trim() || null,
      quantity: quantity.trim() || null,
      year,
      date,
      city: city ?? null,
      rarity: rarity ?? null,
      rarity_note: rarityNote?.trim() || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .select();

  if (error) {
    throw new Error(error.message);
  }

  assertPersisted(data, "Your changes");

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

// Promotes an existing gallery photo to the listing's main/profile image:
// upserts approved_photos with its URL, then drops the gallery row. The file
// itself stays in the bobblehead-approved bucket — it's now referenced by the
// main photo instead of the gallery — so we delete only the DB row.
//
// The photo the promotion displaces (`previousMainUrl` — the outgoing main
// photo or curated seed) is demoted back into the gallery so it isn't lost.
// When there was nothing to demote (only the team placeholder was showing) the
// caller passes null; the returned demoted photo is null in that case. We move
// it down first, so a failure there leaves the current main untouched.
export async function setGalleryPhotoAsMain({
  user,
  teamSlug,
  bobbleheadId,
  photo,
  previousMainUrl,
}: {
  user: User;
  teamSlug: string;
  bobbleheadId: string;
  photo: { id: string; imageUrl: string };
  previousMainUrl?: string | null;
}): Promise<{ demotedPhoto: GalleryPhoto | null }> {
  let demotedPhoto: GalleryPhoto | null = null;

  // Skip when the outgoing main is the very photo we're promoting (it's leaving
  // the gallery anyway) — that would just reinsert it.
  if (previousMainUrl && previousMainUrl !== photo.imageUrl) {
    const { data, error: demoteError } = await supabase
      .from("bobblehead_gallery_photos")
      .insert({
        bobblehead_id: bobbleheadId,
        team_slug: teamSlug,
        image_url: previousMainUrl,
        approved_by: user.id,
      })
      .select("id, image_url, created_at")
      .single();

    if (demoteError) {
      throw new Error(demoteError.message);
    }

    demotedPhoto = { id: data.id, imageUrl: data.image_url, createdAt: data.created_at };
  }

  const { error } = await supabase.from("approved_photos").upsert(
    {
      bobblehead_id: bobbleheadId,
      team_slug: teamSlug,
      image_url: photo.imageUrl,
      approved_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "team_slug,bobblehead_id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  const { data: deletedGalleryRows, error: galleryError } = await supabase
    .from("bobblehead_gallery_photos")
    .delete()
    .eq("id", photo.id)
    .select();

  if (galleryError) {
    throw new Error(galleryError.message);
  }

  assertPersisted(deletedGalleryRows, "The photo change");

  return { demotedPhoto };
}

// Swaps one gallery photo for a freshly uploaded file. Done as insert-then-
// delete rather than an update because the gallery table grants admins and reps
// insert and delete but no update — the update would be filtered to zero rows
// and read as an expired session. The new row inherits the old one's created_at
// so the replacement keeps its place in the strip.
export async function replaceGalleryPhoto({
  user,
  teamSlug,
  bobbleheadId,
  photo,
  file,
}: {
  user: User;
  teamSlug: string;
  bobbleheadId: string;
  photo: GalleryPhoto;
  file: File;
}): Promise<GalleryPhoto> {
  const imageUrl = await uploadPhotoDirect(file);

  const { data, error } = await supabase
    .from("bobblehead_gallery_photos")
    .insert({
      bobblehead_id: bobbleheadId,
      team_slug: teamSlug,
      image_url: imageUrl,
      approved_by: user.id,
      created_at: photo.createdAt,
    })
    .select("id, image_url, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // The old row goes only once the new one is safely in, so a failure here
  // leaves a duplicate rather than losing the photo outright.
  const { data: deletedRows, error: deleteError } = await supabase
    .from("bobblehead_gallery_photos")
    .delete()
    .eq("id", photo.id)
    .select();

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  assertPersisted(deletedRows, "The photo");

  await removeApprovedFile(photo.imageUrl);

  return { id: data.id, imageUrl: data.image_url, createdAt: data.created_at };
}

export async function deleteGalleryPhoto(photo: { id: string; imageUrl: string }) {
  const { data, error } = await supabase
    .from("bobblehead_gallery_photos")
    .delete()
    .eq("id", photo.id)
    .select();

  if (error) {
    throw new Error(error.message);
  }

  assertPersisted(data, "The photo");

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

// Clears a curated listing's seed photo — the imageUrl baked into
// data/giveaways/*.json at build time. There's no row to delete and no file we
// own, so removal is a flag on the override row instead; the detail and team
// pages fall through to the gallery photo or team placeholder once it's set.
// Only reachable when the seed image is the one actually on screen: with an
// approved photo layered on top, "remove" peels that off first and reveals the
// seed, same as before.
export async function hideCuratedSeedPhoto({
  user,
  teamSlug,
  bobbleheadId,
}: {
  user: User;
  teamSlug: string;
  bobbleheadId: string;
}) {
  const { data, error } = await supabase
    .from("bobblehead_overrides")
    .upsert({
      team_slug: teamSlug,
      bobblehead_id: bobbleheadId,
      photo_hidden: true,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .select();

  if (error) {
    throw new Error(error.message);
  }

  assertPersisted(data, "The photo");
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
  nickname,
  quantity,
  year,
  date,
  city,
  rarity,
  rarityNote,
  file,
}: {
  user: User;
  teamSlug: string;
  bobbleheadId: string;
  title: string;
  nickname: string;
  quantity: string;
  year: string;
  date: string;
  /** Athletics only; null on every other team. See lib/athleticsCity.ts. */
  city?: string | null;
  /** Hand-set badge; null clears it. Nothing derives it. See lib/rarity.ts. */
  rarity?: RarityTier | null;
  rarityNote?: string;
  file?: File;
}) {
  const imageUrl = file ? await savePhoto(user, teamSlug, bobbleheadId, file) : null;

  const { data, error } = await supabase
    .from("community_bobbleheads")
    .update({
      title,
      nickname: nickname.trim() || null,
      quantity: quantity.trim() || null,
      year,
      date,
      city: city ?? null,
      rarity: rarity ?? null,
      rarity_note: rarityNote?.trim() || null,
    })
    .eq("id", bobbleheadId)
    .select();

  if (error) {
    throw new Error(error.message);
  }

  assertPersisted(data, "Your changes");

  return { imageUrl };
}
