import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { breadcrumbList } from "@/components/BreadcrumbJsonLd";
import { GIVEAWAYS_BY_TEAM, getGiveawayById } from "@/lib/bobbleheads";
import { getCuratedListingData, getDeletedListingKeys } from "@/lib/curatedListing";
import { getRarity } from "@/lib/rarity";
import { sortNewestFirst } from "@/lib/releaseOrder";
import { siteUrl } from "@/lib/siteUrl";
import { getTeamBySlug } from "@/lib/teams";
import { CuratedBobbleheadPage, type ListingNav } from "./CuratedBobbleheadPage";

export function generateStaticParams() {
  return Object.entries(GIVEAWAYS_BY_TEAM).flatMap(([slug, giveaways]) =>
    giveaways.map((giveaway) => ({
      slug,
      bobbleheadId: giveaway.id,
    })),
  );
}

// Each of the ~3,600 detail pages is a long-tail landing page; a unique
// title/description per listing is the whole point of having them indexed.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bobbleheadId: string }>;
}): Promise<Metadata> {
  const { slug, bobbleheadId } = await params;
  const team = getTeamBySlug(slug);
  const giveaway = getGiveawayById(bobbleheadId, slug);

  if (!team || !giveaway) return { title: "Bobblehead not found" };

  const { override } = await getCuratedListingData(slug, bobbleheadId);
  if (override?.deleted) return { title: "Bobblehead not found" };

  const name = override?.title ?? giveaway.title;
  const date = override?.date ?? giveaway.date;
  const quantity = override?.quantity ?? giveaway.quantity ?? null;
  const teamName = `${team.city} ${team.name}`;
  const title = `${name} bobblehead — ${teamName} (${override?.year ?? giveaway.year})`;
  const description = `${name} stadium giveaway bobblehead from the ${teamName}${
    date && date !== "N/A" ? `, given away ${date}` : ""
  }${quantity?.trim() ? ` — ${quantity} issued` : ""}. Track it in your collection on BobbleShelf.`;
  const path = `/teams/${slug}/bobbleheads/${bobbleheadId}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, type: "website", url: path },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BobbleheadPage({
  params,
}: {
  params: Promise<{ slug: string; bobbleheadId: string }>;
}) {
  const { slug, bobbleheadId } = await params;
  const team = getTeamBySlug(slug);
  const giveaway = getGiveawayById(bobbleheadId, slug);

  if (!team || !giveaway) notFound();

  const [{ override, imageUrl }, deletedKeys] = await Promise.all([
    getCuratedListingData(slug, bobbleheadId),
    getDeletedListingKeys(),
  ]);

  // Admin-deleted listings are gone, not "removed after hydration": the URL
  // 404s and (via sitemap.ts) drops out of the crawl surface.
  if (override?.deleted) notFound();

  // Prev/next follow the team page's default order (newest first), skipping
  // deleted listings, so paging through a team matches the shelf order.
  const ordered = sortNewestFirst(GIVEAWAYS_BY_TEAM[slug] ?? []).filter(
    (entry) => !deletedKeys.has(`${slug}/${entry.id}`),
  );
  const index = ordered.findIndex((entry) => entry.id === bobbleheadId);
  const prev = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;
  // A handful of neighbors double as "related bobbleheads" links so detail
  // pages aren't crawl dead-ends.
  const related = ordered
    .slice(Math.max(0, index - 3), index + 4)
    .filter((entry) => entry.id !== bobbleheadId)
    .map((entry) => ({ id: entry.id, title: entry.title }));
  const nav: ListingNav = {
    position: index >= 0 ? index + 1 : 1,
    total: ordered.length,
    prev: prev ? { id: prev.id, title: prev.title } : null,
    next: next ? { id: next.id, title: next.title } : null,
    related,
  };

  const name = override?.title ?? giveaway.title;
  const quantity = override?.quantity ?? giveaway.quantity ?? null;
  const rarity = getRarity(quantity);
  const base = siteUrl();
  const pageUrl = `${base}/teams/${slug}/bobbleheads/${bobbleheadId}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: `${name} bobblehead`,
        description: `${team.city} ${team.name} stadium giveaway bobblehead${
          quantity?.trim() ? ` — ${quantity} issued` : ""
        }${rarity ? ` (${rarity.label})` : ""}.`,
        url: pageUrl,
        ...(imageUrl || giveaway.imageUrl
          ? { image: new URL(imageUrl ?? giveaway.imageUrl ?? "", base).toString() }
          : {}),
        brand: { "@type": "SportsTeam", name: `${team.city} ${team.name}` },
      },
      breadcrumbList([
        { name: "Teams", path: "/teams" },
        { name: `${team.city} ${team.name}`, path: `/teams/${slug}` },
        { name, path: `/teams/${slug}/bobbleheads/${bobbleheadId}` },
      ]),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CuratedBobbleheadPage
        giveaway={giveaway}
        team={team}
        initialOverride={override}
        initialImageUrl={imageUrl}
        nav={nav}
      />
    </>
  );
}
