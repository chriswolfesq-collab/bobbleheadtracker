import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicShelfView from "@/components/PublicShelfView";
import { getPublicGallery, getPublicShelf } from "@/lib/publicShelf";

// Counts change whenever the owner ticks a bobblehead, and a shelf is most
// likely to be loaded right after its owner shares it — a stale count is
// exactly the wrong first impression. Without this the route would be eligible
// for static optimization and could serve a build-time snapshot.
export const dynamic = "force-dynamic";

type ShelfPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ShelfPageProps): Promise<Metadata> {
  const { slug } = await params;
  const shelf = await getPublicShelf(slug);

  if (!shelf) return { title: "Shelf not found" };

  const { displayName, stats } = shelf;
  const title = `${displayName} has ${stats.totalOwned} MLB bobbleheads`;
  const description = `${stats.totalOwned} of ${stats.siteTotal} stadium giveaway bobbleheads, across ${stats.teamsStarted} of ${stats.teamCount} teams. How many have you got?`;

  return {
    title,
    description,
    // The image itself comes from opengraph-image.tsx alongside this file:
    // file-based metadata outranks anything declared here, so the og:image tag
    // is deliberately absent.
    openGraph: { title, description, type: "profile", url: `/shelf/${slug}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ShelfPage({ params }: ShelfPageProps) {
  const { slug } = await params;
  const [shelf, galleryItems] = await Promise.all([getPublicShelf(slug), getPublicGallery(slug)]);

  // Unknown slug and opted-out shelf both land here, which is what keeps them
  // indistinguishable from outside.
  if (!shelf) notFound();

  const { displayName, countByTeamSlug, totalByTeamSlug, stats } = shelf;

  return (
    <PublicShelfView
      displayName={displayName}
      countByTeamSlug={countByTeamSlug}
      totalByTeamSlug={totalByTeamSlug}
      stats={stats}
      galleryItems={galleryItems}
    />
  );
}
