import { supabase } from "@/lib/supabase";

// Images attached to Team Rep Forum posts. Same architecture as avatars
// (lib/avatar.ts) — the post row carries only a `<user-id>/<uuid>.jpg` path,
// re-validated server-side by the write RPCs — but the bucket is PRIVATE: the
// board is private, so its pictures are read through short-lived signed URLs
// minted against the viewer's own moderator session instead of public URLs.

export const FORUM_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

const ALLOWED_INPUT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

// What the browser is asked to decode, not what gets stored — uploads are
// re-encoded to a bounded JPEG below.
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

// Content size rather than the avatar thumbnail size: a screenshot has to stay
// readable. 1600px on the long edge at q0.85 lands well under the bucket's
// 5 MiB backstop.
const MAX_EDGE = 1600;

/** Signed URLs last an hour — longer than anyone reads a thread, short enough
 *  that a leaked link goes stale the same afternoon. */
const SIGNED_URL_TTL_SECONDS = 3600;

export function validateForumImageFile(file: File): string | null {
  if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    return "iPhone HEIC photos aren't supported yet. In Photos, share the picture as a JPEG, or screenshot it and upload that.";
  }
  if (!ALLOWED_INPUT_TYPES.has(file.type)) {
    return "That file isn't an image we can read. JPEG, PNG, WebP, GIF and AVIF work.";
  }
  if (file.size > MAX_INPUT_BYTES) {
    return "That image is over 15 MB. Try a smaller copy of it.";
  }
  return null;
}

// Downscale-only re-encode: fit within MAX_EDGE at the image's own aspect
// ratio, never upscale. Unlike the avatar path there's no crop — the picture
// is content, not a circle.
async function toBoundedJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("no 2d context");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("canvas.toBlob returned null");
  return blob;
}

/**
 * Upload a post image ahead of the post itself. Returns the storage path to
 * hand to createTopic/postReply. If the post then fails, pass the path to
 * removeForumImages so the orphan doesn't linger.
 */
export async function uploadForumImage(
  userId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const invalid = validateForumImageFile(file);
  if (invalid) return { path: null, error: invalid };

  let blob: Blob;
  try {
    blob = await toBoundedJpeg(file);
  } catch {
    return { path: null, error: "We couldn't read that image. Try a different one." };
  }

  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("forum-images")
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) return { path: null, error: `Upload failed: ${error.message}` };

  return { path, error: null };
}

/** A viewing URL for a post's image, good for an hour. Needs a signed-in
 *  moderator session — the bucket is private and the select policy is what
 *  authorizes the signature. */
export async function forumImageSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("forum-images")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Best-effort sweep of files whose posts are gone (or never made it). A
 *  failure leaks an unreachable file in a private bucket — logged, not
 *  surfaced, since the post operation the user cares about already succeeded. */
export async function removeForumImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from("forum-images").remove(paths);
  if (error) console.error("Failed to sweep forum images:", error.message);
}
