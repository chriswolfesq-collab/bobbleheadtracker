import type { MetadataRoute } from "next";
import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";
import { getCommunityListings } from "@/lib/communityServer";
import { getDeletedListingKeys } from "@/lib/curatedListing";
import { siteUrl } from "@/lib/siteUrl";
import { TEAMS } from "@/lib/teams";

// Crawl surface for the statically-generated public pages: the home page, the
// 30 team pages, and every curated bobblehead detail page. Admin-deleted
// listings 404 and are excluded here too. Community listings (query-string
// URLs backed by the DB) and user shelves are intentionally left out —
// they're dynamic and not part of the evergreen index. Admin, settings, and
// profile routes are private and excluded.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [deletedKeys, communityListings] = await Promise.all([
    getDeletedListingKeys(),
    getCommunityListings(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/teams`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/recently-added`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/upcoming`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/about`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/refer`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/faq`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/community-guidelines`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const teamRoutes: MetadataRoute.Sitemap = TEAMS.map((team) => ({
    url: `${base}/teams/${team.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const bobbleheadRoutes: MetadataRoute.Sitemap = TEAMS.flatMap((team) =>
    (GIVEAWAYS_BY_TEAM[team.slug] ?? [])
      .filter((giveaway) => !deletedKeys.has(`${team.slug}/${giveaway.id}`))
      .map((giveaway) => ({
        url: `${base}/teams/${team.slug}/bobbleheads/${giveaway.id}`,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
  );

  const communityRoutes: MetadataRoute.Sitemap = communityListings.map((listing) => ({
    url: `${base}/teams/${listing.teamSlug}/community/${encodeURIComponent(listing.id)}`,
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  return [...staticRoutes, ...teamRoutes, ...bobbleheadRoutes, ...communityRoutes];
}
