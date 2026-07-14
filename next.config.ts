import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const isGithubPages = process.env.GITHUB_PAGES === "true";
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  output: isGithubPages ? "export" : undefined,
  // No basePath: the site is served from the root of the bobbleshelf.com
  // custom domain (see public/CNAME), not from a /bobbleheadtracker subpath.
  env: {
    NEXT_PUBLIC_BASE_PATH: "",
  },
  images: {
    unoptimized: isGithubPages,
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
