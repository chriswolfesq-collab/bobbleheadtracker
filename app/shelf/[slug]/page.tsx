import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { FriendShelfPanel } from "@/components/FriendShelfPanel";
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
  const title = `${displayName} has ${stats.totalOwned} MLB bobbleheads. Think you've got more?`;
  const description = `${stats.totalOwned} stadium giveaway bobbleheads across ${stats.teamsStarted} of ${stats.teamCount} teams. Build your own shelf and prove you've got the bigger collection.`;

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

  const {
    displayName,
    countByTeamSlug,
    totalByTeamSlug,
    stats,
    memberNumber,
    repTeams,
    approvedSubmissions,
    qualifyingReferrals,
    streakMonths,
  } = shelf;

  return (
    <>
      <BreadcrumbJsonLd trail={[{ name: `${displayName}'s Shelf`, path: `/shelf/${slug}` }]} />
      <PublicShelfView
        showBreadcrumbs
        displayName={displayName}
        countByTeamSlug={countByTeamSlug}
        totalByTeamSlug={totalByTeamSlug}
        stats={stats}
        galleryItems={galleryItems}
        wantedHref={`/shelf/${slug}/wanted`}
        memberNumber={memberNumber}
        repTeams={repTeams}
        approvedSubmissions={approvedSubmissions}
        qualifyingReferrals={qualifyingReferrals}
        streakMonths={streakMonths}
        // A client island: sessions live in the browser, so the server can't
        // know whether the viewer is this shelf's friend — the panel finds out
        // after hydration and upgrades the page in place.
        friendSection={
          <FriendShelfPanel
            slug={slug}
            displayName={displayName}
            publicKinds={Array.from(new Set(galleryItems.map((item) => item.kind)))}
          />
        }
      />
    </>
  );
}
