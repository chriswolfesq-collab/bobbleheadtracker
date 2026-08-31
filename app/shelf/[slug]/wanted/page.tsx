import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { GalleryGrid } from "@/components/PublicGallery";
import { getPublicGallery, getPublicShelf } from "@/lib/publicShelf";

// The whole of a collector's public wanted list, which the shelf page only
// previews (see WANTED_PREVIEW_LIMIT in components/PublicGallery.tsx). Its own
// URL rather than a "show more" button, because this page is the thing people
// actually want to send: "here's what I'm still after" is a link you hand to
// someone standing in a shop, and it shouldn't drag a whole shelf along with it.
//
// Same force-dynamic reasoning as the shelf page: the list changes the moment
// its owner ticks something, and it's most likely to be opened right after they
// shared it.
export const dynamic = "force-dynamic";

type WantedPageProps = { params: Promise<{ slug: string }> };

// Kept in one place because the metadata and the page both need it, and a title
// that disagreed with the heading would be the kind of thing nobody notices
// until it's in a link preview.
async function getWanted(slug: string) {
  const [shelf, galleryItems] = await Promise.all([getPublicShelf(slug), getPublicGallery(slug)]);
  if (!shelf) return null;

  const wanted = galleryItems.filter((item) => item.kind === "wanted");
  // No wanted rows means the owner hasn't turned the wanted list on (or has
  // nothing on it). Either way there's no page here — and answering the same
  // way as an unknown slug is what stops this route becoming a way to probe
  // which shelves keep their list private.
  if (wanted.length === 0) return null;

  return { displayName: shelf.displayName, wanted };
}

export async function generateMetadata({ params }: WantedPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getWanted(slug);

  if (!data) return { title: "Wanted list not found" };

  const { displayName, wanted } = data;
  const title = `${wanted.length} bobbleheads ${displayName} is still after`;
  const description = `The stadium giveaway bobbleheads ${displayName} is hunting for. Spot one of these and you know it's not already on the shelf.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "profile", url: `/shelf/${slug}/wanted` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ShelfWantedPage({ params }: WantedPageProps) {
  const { slug } = await params;
  const data = await getWanted(slug);

  if (!data) notFound();

  const { displayName, wanted } = data;

  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <BreadcrumbJsonLd
        trail={[
          { name: `${displayName}'s Shelf`, path: `/shelf/${slug}` },
          { name: "Wanted list", path: `/shelf/${slug}/wanted` },
        ]}
      />
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <Breadcrumbs
          className="mb-4"
          items={[
            { href: "/", label: "Home" },
            { href: `/shelf/${slug}`, label: `${displayName}'s Shelf` },
            { label: "Wanted list" },
          ]}
        />

        <header className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent/80 sm:text-xs">
            Wanted list
          </p>
          <h1 className="mt-2 text-2xl font-black text-zinc-900">
            What {displayName} is still hunting for
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            {wanted.length} stadium giveaway bobbleheads they don&rsquo;t have yet. Spot one of
            these and it&rsquo;s not already on the shelf.
          </p>
        </header>

        <div className="mt-8">
          <GalleryGrid items={wanted} />
        </div>

        <div className="mt-10 text-center">
          <Link
            href={`/shelf/${slug}`}
            className="inline-block rounded-full border border-black/15 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover"
          >
            Back to {displayName}&rsquo;s shelf
          </Link>
        </div>
      </div>
    </div>
  );
}
