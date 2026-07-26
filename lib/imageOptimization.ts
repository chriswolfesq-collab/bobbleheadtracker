// Whether a given image src should be handed to Next's image optimizer.
//
// Local/relative assets are always optimized. For remote images the trade-off
// is real: routing a host through the optimizer resizes and re-encodes it
// (smaller, WebP) — a big win — but a host that hotlink-blocks or rate-limits
// Vercel's optimizer would break the image instead of merely serving it large.
// So we only opt in the hosts we trust to behave: img.mlbstatic.com (430 of the
// ~446 curated listing images, an MLB CDN) and our own Supabase Storage host
// (user-uploaded photos). Every other scraped host — Twitter, Reddit, eBay,
// Pinterest, Mercari, etc. — stays unoptimized and served as-is, exactly as
// before. To optimize another host, add it here AND to next.config.ts
// remotePatterns.
const OPTIMIZE_REMOTE_HOSTS = new Set(["img.mlbstatic.com"]);

function supabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Value for next/image's `unoptimized` prop. True (skip the optimizer) for
 * remote hosts we don't trust through it; false (optimize) for local assets and
 * the trusted CDNs. Replaces the blanket `src.startsWith("http")` that disabled
 * optimization for every remote image.
 */
export function isUnoptimizedImage(src: string | undefined | null): boolean {
  if (!src || !/^https?:\/\//.test(src)) return false;

  let host: string;
  try {
    host = new URL(src).hostname;
  } catch {
    return true;
  }

  if (OPTIMIZE_REMOTE_HOSTS.has(host)) return false;
  if (host === supabaseHost()) return false;
  return true;
}
