// Client-side mirror of the Storage bucket caps in supabase/storage_limits.sql.
//
// The bucket enforces these itself at upload time — that's the backstop a
// hand-rolled request can't skip — but its rejection surfaces as a terse API
// error ("Payload too large"). Checking here first turns that into a message
// that tells the person what to actually do. Keep the two lists in step: a
// type allowed here but not on the bucket would pass this check and then fail
// the upload with the unfriendly error anyway.

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB, matches file_size_limit

const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/** Returns a user-ready error message, or null when the file is uploadable. */
export function validatePhotoFile(file: File): string | null {
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
    // The common real-world case is an iPhone photo kept in HEIC format, which
    // the picker's accept="image/*" happily lets through.
    return "That image format isn't supported. Please use a JPG, PNG, WebP, or GIF.";
  }

  if (file.size > MAX_PHOTO_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return `That photo is ${sizeMb} MB — the limit is 10 MB. Try a smaller export or a screenshot.`;
  }

  return null;
}
