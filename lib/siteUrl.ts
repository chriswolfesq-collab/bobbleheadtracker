// The site's absolute origin, resolved to follow the deployment rather than a
// hardcoded domain. Production is pinned to bobbleshelf.com; a Vercel preview
// build advertises its own per-deployment host (so preview share cards and
// sitemaps point at the preview, not production); local dev falls back to
// localhost. VERCEL_URL is the per-deployment host and is unset locally.
//
// Used by the root metadataBase (app/layout.tsx) and the sitemap/robots routes,
// which need fully-qualified URLs that crawlers can follow.
export function siteUrl(): string {
  if (process.env.VERCEL_ENV === "production") return "https://bobbleshelf.com";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
