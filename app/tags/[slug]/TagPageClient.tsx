"use client";

import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { publicAsset } from "@/lib/paths";
import { useTaggedListings, useTagVocabulary } from "@/lib/useTags";

// Everything carrying one tag, across every team. The page a tag chip links to,
// and the reason a chip is a link rather than a search: a theme is a place you
// can send someone, not a query they have to retype.

export function TagPageClient({ slug }: { slug: string }) {
  const { listings, isLoading } = useTaggedListings(slug);
  const { tags, isLoading: isLoadingVocabulary } = useTagVocabulary();

  // Falls back to the slug rather than blocking on the vocabulary, so the
  // heading is right from the first paint in the common case and merely
  // unpolished in the rare one.
  const label = tags.find((tag) => tag.slug === slug)?.label ?? slug;
  const isUnknown = !isLoadingVocabulary && !tags.some((tag) => tag.slug === slug);

  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <Breadcrumbs
          items={[{ href: "/", label: "Home" }, { href: "/tags", label: "Tags" }, { label }]}
        />

        <h1 className="mt-4 font-display text-4xl font-bold uppercase tracking-wide text-navy">
          {label}
        </h1>

        {isLoading ? (
          <p className="mt-8 text-sm text-zinc-600">Loading…</p>
        ) : isUnknown ? (
          <p className="mt-8 text-sm text-zinc-600">
            There&apos;s no <strong>{slug}</strong> tag.{" "}
            <Link href="/tags" className="font-semibold text-accent hover:text-accent-hover">
              Browse all tags
            </Link>
            .
          </p>
        ) : listings.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-600">Nothing carries this tag yet.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-zinc-600">
              {listings.length} {listings.length === 1 ? "bobblehead" : "bobbleheads"}
            </p>

            <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {listings.map((listing) => (
                <li key={`${listing.teamSlug}:${listing.bobbleheadId}`}>
                  <Link
                    href={listing.href}
                    className="group flex h-full flex-col overflow-hidden rounded-xl border border-border-soft bg-white transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <div className="flex h-36 items-end justify-center bg-[radial-gradient(circle_at_50%_18%,#ffffff,#f2ead9_78%)] pt-4">
                      <Image
                        src={listing.imageUrl ?? publicAsset(`/bobbleheads/${listing.teamSlug}.png`)}
                        alt=""
                        width={135}
                        height={321}
                        aria-hidden
                        unoptimized={Boolean(listing.imageUrl?.startsWith("http"))}
                        className="h-32 w-auto object-contain mix-blend-multiply drop-shadow-[0_8px_8px_rgba(58,36,18,0.3)]"
                      />
                    </div>
                    <div className="p-3">
                      <p className="font-display text-sm font-bold uppercase leading-tight tracking-wide text-navy">
                        {listing.title}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
