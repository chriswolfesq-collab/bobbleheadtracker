import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Profile photos. The image lives in the public `avatars` bucket at
// `<user-id>/<uuid>.jpg`; what the account carries around is only that *path*,
// in auth user_metadata under `avatar_path` (the same write path as
// display_name — profiles has no update policy, see supabase/avatars.sql). A
// path and not a URL on purpose: user_metadata is client-writable free text,
// and anything stored there ends up inside <img> tags shown to other people,
// so the stored value is constrained to name a file only its owner could have
// uploaded. Both the database trigger and getAvatarUrl() below enforce the
// same `<own-user-id>/<filename>` shape.

/** Mirrors the bucket's allow-list (supabase/avatars.sql) plus the formats the
 *  browser can decode for us — everything is re-encoded to JPEG before upload,
 *  so the *input* can be anything decodable. */
const ALLOWED_INPUT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

// A cap on what we'll ask the browser to decode, not on what gets stored —
// the re-encoded upload is a 256px JPEG of a few dozen KB regardless.
const MAX_AVATAR_INPUT_BYTES = 10 * 1024 * 1024;

// 256px covers every place an avatar renders (the largest is 64 CSS px, so
// 256 is comfortable even on a 3x display) while keeping files small enough
// that plain <img> tags need no optimizer in front of them.
const AVATAR_SIZE = 256;

function isOwnAvatarPath(path: unknown, userId: string): path is string {
  return typeof path === "string" && new RegExp(`^${userId}/[A-Za-z0-9._-]+$`).test(path);
}

/** Builds the public URL for an avatar path that came back from the database
 *  (e.g. the forum RPCs' author_avatar_path). Null in, null out, so callers
 *  can pass rows through without ceremony. */
export function avatarPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/avatars/${path}`;
}

/** The signed-in user's own avatar, straight from their auth metadata — no
 *  round trip. Re-validates the path shape because metadata is client-writable:
 *  a value that doesn't look like a file in this user's own folder renders as
 *  initials, not as an <img> pointed somewhere else. */
export function getAvatarUrl(user: User | null): string | null {
  if (!user) return null;
  const path = user.user_metadata?.avatar_path;
  return isOwnAvatarPath(path, user.id) ? avatarPublicUrl(path) : null;
}

function validateAvatarFile(file: File): string | null {
  // The common iPhone case, called out by name: HEIC can't be decoded by the
  // canvas, and "not supported" without the fix reads as the site being broken.
  if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    return "iPhone HEIC photos aren't supported yet. In Photos, share the picture as a JPEG, or screenshot it and upload that.";
  }
  if (!ALLOWED_INPUT_TYPES.has(file.type)) {
    return "That file isn't an image we can read. JPEG, PNG, WebP, GIF and AVIF work.";
  }
  if (file.size > MAX_AVATAR_INPUT_BYTES) {
    return "That photo is over 10 MB. Try a smaller copy of it.";
  }
  return null;
}

// Center-crops to a square and re-encodes at AVATAR_SIZE. Every upload goes
// through this, which is what lets the bucket cap files at 1 MiB and the UI
// render raw <img> tags: nothing big ever reaches storage.
async function toSquareJpeg(file: File): Promise<Blob> {
  // EXIF orientation is applied at decode. 'from-image' is the default in
  // current browsers, but it's named explicitly because a sideways avatar is
  // exactly the kind of bug nobody files a report about.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("no 2d context");
  }
  // JPEG has no alpha; transparent PNG corners composite onto white rather
  // than the default black, which reads as a broken image in a light UI.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  context.imageSmoothingQuality = "high";
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("canvas.toBlob returned null");
  return blob;
}

/**
 * Validate, downscale, upload, then point the account at the new file. The
 * caller's UI refreshes on its own: updateUser fires a USER_UPDATED auth event,
 * which flows through AuthProvider's onAuthStateChange into every consumer.
 */
export async function uploadAvatar(user: User, file: File): Promise<{ error: string | null }> {
  const invalid = validateAvatarFile(file);
  if (invalid) return { error: invalid };

  let blob: Blob;
  try {
    blob = await toSquareJpeg(file);
  } catch {
    return { error: "We couldn't read that image. Try a different photo." };
  }

  // A fresh UUID per upload rather than a fixed name: the object under a given
  // URL never changes, so it can be cached for a year (the year, not the 3600
  // the photo buckets use — those keys are minted before review and can be
  // superseded; this one is immutable by construction).
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` };
  }

  const { error: saveError } = await supabase.auth.updateUser({
    data: { avatar_path: path },
  });
  if (saveError) {
    // The account still points at the old photo, so the new orphan is the only
    // thing to clean up. Best effort — a leaked 30 KB file is not worth
    // surfacing a second error over.
    void supabase.storage.from("avatars").remove([path]);
    return { error: saveError.message };
  }

  void removeOtherAvatarFiles(user.id, path);
  return { error: null };
}

export async function removeAvatar(user: User): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ data: { avatar_path: null } });
  if (error) return { error: error.message };
  void removeOtherAvatarFiles(user.id, null);
  return { error: null };
}

// Sweeps the caller's folder down to the file in use (or to nothing). Fire and
// forget from both callers: the pointer has already moved, so a failure here
// leaks an unreferenced file rather than breaking anything visible — and the
// next successful sweep collects it anyway.
async function removeOtherAvatarFiles(userId: string, keep: string | null): Promise<void> {
  const { data, error } = await supabase.storage.from("avatars").list(userId);
  if (error || !data) return;
  const stale = data.map((object) => `${userId}/${object.name}`).filter((path) => path !== keep);
  if (stale.length > 0) {
    void supabase.storage.from("avatars").remove(stale);
  }
}
