import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCommunityListing } from "@/lib/communityServer";
import { siteUrl } from "@/lib/siteUrl";
import { getTeamBySlug } from "@/lib/teams";
import { CommunityBobbleheadPage } from "../CommunityBobbleheadPage";

// Server-rendered home for a community listing (previously only reachable as
// /community?id=..., which crawlers never indexed). The client component
// still fetches live data; this route supplies real URLs, metadata, and
// JSON-LD.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; bobbleheadId: string }>;
}): Promise<Metadata> {
  const { slug, bobbleheadId } = await params;
  const team = getTeamBySlug(slug);
  if (!team) return { title: "Bobblehead not found" };

  const listing = await getCommunityListing(slug, bobbleheadId);
  if (!listing) return { title: "Bobblehead not found" };

  const teamName = `${team.city} ${team.name}`;
  const title = `${listing.title} bobblehead — ${teamName} (${listing.year})`;
  const description = `${listing.title} stadium giveaway bobblehead from the ${teamName}${
    listing.date && listing.date !== "N/A" ? `, given away ${listing.date}` : ""
  }. A community-submitted listing on BobbleShelf.`;
  const path = `/teams/${slug}/community/${bobbleheadId}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, type: "website", url: path },
  };
}

export default async function CommunityListingPage({
  params,
}: {
  params: Promise<{ slug: string; bobbleheadId: string }>;
}) {
  const { slug, bobbleheadId } = await params;
  const team = getTeamBySlug(slug);
  if (!team) notFound();

  const listing = await getCommunityListing(slug, bobbleheadId);
  if (!listing) notFound();

  const base = siteUrl();
  const pageUrl = `${base}/teams/${slug}/community/${bobbleheadId}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: `${listing.title} bobblehead`,
        description: `${team.city} ${team.name} stadium giveaway bobblehead (community listing).`,
        url: pageUrl,
        ...(listing.imageUrl ? { image: new URL(listing.imageUrl, base).toString() } : {}),
        brand: { "@type": "SportsTeam", name: `${team.city} ${team.name}` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "BobbleShelf", item: base },
          { "@type": "ListItem", position: 2, name: "Teams", item: `${base}/teams` },
          {
            "@type": "ListItem",
            position: 3,
            name: `${team.city} ${team.name}`,
            item: `${base}/teams/${slug}`,
          },
          { "@type": "ListItem", position: 4, name: listing.title, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={null}>
        <CommunityBobbleheadPage team={team} bobbleheadId={bobbleheadId} />
      </Suspense>
    </>
  );
}
