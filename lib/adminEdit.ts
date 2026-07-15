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
