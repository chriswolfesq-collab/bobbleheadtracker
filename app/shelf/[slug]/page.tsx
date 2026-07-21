import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DisplayCase from "@/components/DisplayCase";
import PublicGallery from "@/components/PublicGallery";
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
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
        <header className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent/80 sm:text-xs">
            MLB Bobblehead Shelf
          </p>
          <h1 className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">{displayName}</h1>

          {/* The count is the point of the page: it's what gets posted, what a
              rival collector measures themselves against, and the reason they
              click through. Everything else is supporting detail. */}
          <p className="mt-6 text-7xl font-black leading-none tabular-nums text-accent sm:text-8xl">
            {stats.totalOwned}
          </p>
          <p className="mt-2 text-sm font-black uppercase tracking-[0.3em] text-zinc-700 dark:text-zinc-300">
            Bobbleheads
          </p>

          <div className="mx-auto mt-6 max-w-sm">
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${stats.pctComplete}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-bold text-zinc-500">
              {stats.totalOwned} of {stats.siteTotal} · {stats.pctComplete}% · {stats.teamsStarted}/
              {stats.teamCount} teams started
            </p>
          </div>
        </header>

        <div className="mt-8">
          <DisplayCase countByTeamSlug={countByTeamSlug} totalByTeamSlug={totalByTeamSlug} />
        </div>

        {/* Opt-in only: getPublicGallery returns nothing unless the owner turned
            the gallery on, so most shelves stay counts-only and render nothing here. */}
        {galleryItems.length > 0 ? (
          <PublicGallery displayName={displayName} items={galleryItems} />
        ) : null}

        {/* The whole reason the page is public. Whoever is reading this arrived
            from someone else's post, so the ask is to go build their own. */}
        <div className="mt-10 rounded-2xl border border-accent/30 bg-accent/5 p-6 text-center">
          <p className="text-lg font-black text-zinc-900 dark:text-white">Think your shelf beats this?</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
            Track every stadium giveaway bobblehead across all 30 teams, then put your own count up
            here.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-accent px-6 py-3 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover"
          >
            Build your shelf
          </Link>
        </div>
      </div>
    </div>
  );
}
