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
