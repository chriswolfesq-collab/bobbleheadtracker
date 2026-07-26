import type { MetadataRoute } from "next";
import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";
import { siteUrl } from "@/lib/siteUrl";
import { TEAMS } from "@/lib/teams";

// Crawl surface for the statically-generated public pages: the home page, the
// 30 team pages, and every curated bobblehead detail page. Community listings
// (query-string URLs backed by the DB) and user shelves are intentionally left
// out — they're dynamic and not part of the evergreen index. Admin, settings,
// and profile routes are private and excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/recently-added`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const teamRoutes: MetadataRoute.Sitemap = TEAMS.map((team) => ({
    url: `${base}/teams/${team.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const bobbleheadRoutes: MetadataRoute.Sitemap = TEAMS.flatMap((team) =>
    (GIVEAWAYS_BY_TEAM[team.slug] ?? []).map((giveaway) => ({
      url: `${base}/teams/${team.slug}/bobbleheads/${giveaway.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  );

  return [...staticRoutes, ...teamRoutes, ...bobbleheadRoutes];
}
