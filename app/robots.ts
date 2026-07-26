import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

// Let crawlers index the public pages but keep them out of the admin console,
// the per-user settings/profile pages, and the internal search endpoint. The
// sitemap points at the same origin so it follows the deployment.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/settings", "/profile"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
