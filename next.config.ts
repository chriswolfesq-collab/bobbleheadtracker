import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // `next dev` holds an exclusive lock on the dist dir, so a second dev server
  // in this repo (a parallel Claude session, usually) can't start at all.
  // Pointing it at its own dist dir via NEXT_DIST_DIR sidesteps the lock;
  // unset, everything stays in .next as before.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // The OG image reads its fonts with readFile(join(process.cwd(), "assets/…")),
  // a path built at runtime that the static trace can't see — so the fonts were
  // left out of the deployed bundle and the route 500'd on Vercel while working
  // locally, where the files are simply on disk.
  //
  // The key is a route glob matched with picomatch, so the brackets in [slug]
  // are escaped: unescaped they'd read as a character class and never match.
  outputFileTracingIncludes: {
    "/shelf/\\[slug\\]/opengraph-image": ["./assets/**"],
    // The per-listing card is force-dynamic, so unlike the team card it renders
    // on the server at request time and needs the fonts in the deployed bundle
    // for the same reason the shelf card does.
    "/teams/\\[slug\\]/bobbleheads/\\[bobbleheadId\\]/opengraph-image": ["./assets/**"],
  },
  images: {
    // Vercel bills image optimization per transformation — one per unique
    // (src, width, quality) — and a transformation is re-billed once its cache
    // entry expires. Next 16 defaults this to 4 hours, so a photo that never
    // changes was being re-optimized up to six times a day. A curated listing
    // photo is immutable (a new photo is a new URL), so hold them for a year.
    minimumCacheTTL: 31_536_000,
    // The width matrix is the other half of that bill: every width Next
    // advertises in a srcset is its own billable transformation. The defaults
    // are 8 device widths + 7 fixed widths; these cover the `sizes` the site
    // actually uses (SHELF_FIGURE_SIZES, the 90/120/160px avatars and thumbs,
    // and the full-bleed banners) at 1x and 2x with roughly half as many.
    // Dropping 3840 matters most — a 4K re-encode is the priciest of the set
    // and nothing here is displayed anywhere near that size.
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [96, 192, 384],
    // Every remote host a listing image can come from. These are enforced by the
    // optimizer, so an unlisted host is a broken image rather than a slow one.
    remotePatterns: [
      { protocol: "https", hostname: "img.mlbstatic.com" },
      { protocol: "https", hostname: "bullpenbobbles.com" },
      { protocol: "https", hostname: "preview.redd.it" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "www.kevinsavagecards.com" },
      { protocol: "https", hostname: "i.ebayimg.com" },
      { protocol: "https", hostname: "encrypted-tbn0.gstatic.com" },
      { protocol: "https", hostname: "www.stadiumgiveawayexchange.com" },
      { protocol: "http", hostname: "www.stadiumgiveawayexchange.com" },
      { protocol: "https", hostname: "u-mercari-images.mercdn.net" },
      { protocol: "https", hostname: "i.pinimg.com" },
      { protocol: "https", hostname: "images.pristineauction.com" },
      { protocol: "https", hostname: "images.saymedia-content.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      ...(supabaseHostname
        ? [{ protocol: "https" as const, hostname: supabaseHostname }]
        : []),
    ],
  },
  turbopack: {
    root,
  },
};

export default nextConfig;
