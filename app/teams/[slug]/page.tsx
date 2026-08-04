import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { breadcrumbList } from "@/components/BreadcrumbJsonLd";
import { getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import { siteUrl } from "@/lib/siteUrl";
import { TEAMS, getTeamBySlug } from "@/lib/teams";
import {
  getTeamGallerySeed,
  getTeamListingCount,
  getTeamListings,
  getTeamPhotoSeed,
} from "@/lib/teamListings";
import { TeamPageClient } from "./TeamPageClient";

export function generateStaticParams() {
  return TEAMS.map((team) => ({ slug: team.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const team = getTeamBySlug(slug);

  if (!team) return { title: "Team not found" };

  const count = await getTeamListingCount(slug, getGiveawaysByTeamSlug(slug));
  const name = `${team.city} ${team.name}`;
  const title = `${name} bobbleheads — ${count} stadium giveaways`;
  const description = `Every ${name} SGA bobblehead giveaway, tracked. ${count} in the database. Track the ones you own.`;

  return {
    title,
    description,
    // The image itself comes from opengraph-image.tsx alongside this file:
    // file-based metadata outranks anything declared here, so the og:image tag
    // is deliberately absent.
    openGraph: { title, description, type: "website", url: `/teams/${slug}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = getTeamBySlug(slug);

  if (!team) notFound();

  const giveaways = getGiveawaysByTeamSlug(team.slug);

  // The list the page ships as HTML: catalog + admin edits + community
  // listings, already merged. The client rebuilds it from its own live reads
  // once they land, but a crawler, a link preview, or a first paint no longer
  // sees the raw catalog — community listings missing, deleted ones present.
  const [listings, photoSeed, gallerySeed] = await Promise.all([
    getTeamListings(team.slug, giveaways),
    getTeamPhotoSeed(team.slug),
    getTeamGallerySeed(team.slug),
  ]);

  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: `${team.city} ${team.name} bobbleheads`,
        url: `${base}/teams/${team.slug}`,
        about: { "@type": "SportsTeam", name: `${team.city} ${team.name}` },
      },
      breadcrumbList([
        { name: "Teams", path: "/teams" },
        { name: `${team.city} ${team.name}`, path: `/teams/${team.slug}` },
      ]),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TeamPageClient
        gallerySeed={gallerySeed}
        giveaways={giveaways}
        listings={listings}
        photoSeed={photoSeed}
        team={team}
      />
    </>
  );
}
