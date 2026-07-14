import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  images: {
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
    ],
  },
  turbopack: {
    root,
  },
};

export default nextConfig;
