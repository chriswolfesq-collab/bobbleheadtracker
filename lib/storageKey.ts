// Builds a Supabase Storage object key for an uploaded file.
//
// Supabase Storage rejects keys containing characters outside a narrow safe set
// with an "Invalid key" error. Device filenames routinely violate this — e.g.
// "Screenshot 2026-07-23 at 4.58.24 PM.png" has spaces the API won't accept — so
// we never put the raw name in the key. A random UUID already makes the key
// unique; all we keep from the original file is a sanitized extension, so the
// file still serves with a sensible type and URL.
export function storageKeyForFile(fileName: string, prefix?: string): string {
  const id = crypto.randomUUID();
  const extension = fileName.match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase();
  const base = extension ? `${id}.${extension}` : id;
  return prefix ? `${prefix}/${base}` : base;
}
