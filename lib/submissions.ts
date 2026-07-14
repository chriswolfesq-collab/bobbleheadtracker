"use client";

import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

async function uploadPendingPhoto(user: User, file: File): Promise<string> {
  const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
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

  const { error } = await supabase.from("submissions").insert({
    kind: "photo_for_existing",
    target_bobblehead_id: bobbleheadId,
    team_slug: teamSlug,
    storage_path: storagePath,
    submitted_by: user.id,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function submitNewBobblehead({
  user,
  teamSlug,
  title,
  year,
  date,
  file,
}: {
  user: User;
  teamSlug: string;
  title: string;
  year: string;
  date: string;
  file: File;
}) {
  const storagePath = await uploadPendingPhoto(user, file);

  const { error } = await supabase.from("submissions").insert({
    kind: "new_bobblehead",
    team_slug: teamSlug,
    title,
    year: year || "Unknown",
    date: date || "N/A",
    storage_path: storagePath,
    submitted_by: user.id,
  });

  if (error) {
    throw new Error(error.message);
  }
}
