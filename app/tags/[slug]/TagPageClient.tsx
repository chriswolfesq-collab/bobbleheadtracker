"use client";

import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { type BobbleheadIdentity, listingKey } from "@/lib/bobbleheadIdentity";
import { publicAsset } from "@/lib/paths";
import { useOwnedKeys } from "@/lib/profile";
import { tagCompletionPercent } from "@/lib/tags";
import { useTaggedListings, useTagVocabulary } from "@/lib/useTags";

// Everything carrying one tag, across every team. The page a tag chip links to,
// and the reason a chip is a link rather than a search: a theme is a place you
// can send someone, not a query they have to retype.
//
// A tag is also a checklist — "how many of the Star Wars ones do I have?" is a
// question a team-by-team collection can't answer — so the page counts what you
// own against it and lets you check listings off without leaving.

/** Owned/total for the tag, shown above the grid. */
function TagProgressPanel({
  total,
  ownedCount,
  isKnown,
  isLoggedIn,
}: {
  total: number;
  ownedCount: number;
  isKnown: boolean;
  isLoggedIn: boolean;
}) {
  const percent = isKnown ? tagCompletionPercent(ownedCount, total) : null;

  return (
    <div className="mt-6 flex items-center gap-4 rounded-xl border border-border-soft bg-surface px-4 py-3 shadow-sm sm:px-6">
      <ProgressRing percent={percent} />
      <div className="min-w-0">
        <p className="font-display text-lg font-bold uppercase tracking-wide text-navy">
          {isKnown ? `${ownedCount} of ${total} collected` : `${total} in this tag`}
        </p>
        <p className="mt-0.5 text-sm text-zinc-600">
          {!isLoggedIn
            ? "Log in to track your progress on this tag."
            : !isKnown
              ? "Counting what you own…"
              : ownedCount >= total
                ? "You've got every one of them."
                : `${total - ownedCount} to go — check them off as they land on your shelf.`}
        </p>
      </div>
    </div>
  );
}

function TaggedCard({
  listing,
  isOwned,
  canToggle,
  isLoggedIn,
  onToggle,
}: {
  listing: BobbleheadIdentity;
  isOwned: boolean;
  canToggle: boolean;
  isLoggedIn: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative h-full">
      {/* Outside the Link rather than inside it: a button nested in an anchor is
          invalid, and checking something off shouldn't navigate away from the
          list you're working through. */}
      <button
        type="button"
        aria-pressed={isOwned}
        disabled={!canToggle}
        aria-label={
          isLoggedIn
            ? `Mark ${listing.title} as ${isOwned ? "not owned" : "owned"}`
            : `${listing.title} is ${isOwned ? "owned" : "not owned"} — log in to track`
        }
        title={isLoggedIn ? (isOwned ? "Remove as owned" : "Mark as owned") : "Log in to track"}
        onClick={onToggle}
        className="absolute left-2 top-2 z-10 grid h-6 w-6 place-items-center rounded border border-zinc-300 bg-white/90 text-xs text-zinc-800 shadow-sm transition hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed enabled:cursor-pointer"
      >
        {isOwned ? (
          <span className="grid h-full w-full place-items-center rounded bg-green-600 font-black text-white">
            ✓
          </span>
        ) : isLoggedIn && !canToggle ? (
          <span aria-hidden className="h-full w-full animate-pulse rounded bg-black/10" />
        ) : null}
      </button>

      <Link
        href={listing.href}
        className={`group flex h-full flex-col overflow-hidden rounded-xl border bg-white transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          isOwned ? "border-green-600/50" : "border-border-soft"
        }`}
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
    </div>
  );
}

export function TagPageClient({ slug }: { slug: string }) {
  const { listings, isLoading } = useTaggedListings(slug);
  const { tags, isLoading: isLoadingVocabulary } = useTagVocabulary();
  const { ownedKeys, isLoading: isLoadingOwned, isLoggedIn, setOwned } = useOwnedKeys();

  // Falls back to the slug rather than blocking on the vocabulary, so the
  // heading is right from the first paint in the common case and merely
  // unpolished in the rare one.
  const label = tags.find((tag) => tag.slug === slug)?.label ?? slug;
  const isUnknown = !isLoadingVocabulary && !tags.some((tag) => tag.slug === slug);

  // Ownership stays unknown rather than zero until the collection has loaded,
  // so a full checklist never flashes as an empty one.
  const isProgressKnown = isLoggedIn && !isLoadingOwned;
  const ownedCount = listings.filter((listing) =>
    ownedKeys.has(listingKey(listing.teamSlug, listing.bobbleheadId)),
  ).length;

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
            <TagProgressPanel
              total={listings.length}
              ownedCount={ownedCount}
              isKnown={isProgressKnown}
              isLoggedIn={isLoggedIn}
            />

            <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {listings.map((listing) => {
                const key = listingKey(listing.teamSlug, listing.bobbleheadId);
                const isOwned = ownedKeys.has(key);

                return (
                  <li key={key}>
                    <TaggedCard
                      listing={listing}
                      isOwned={isOwned}
                      canToggle={isProgressKnown}
                      isLoggedIn={isLoggedIn}
                      onToggle={() => setOwned(listing.teamSlug, listing.bobbleheadId, !isOwned)}
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
