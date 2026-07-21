"use client";

import Link from "next/link";
import PublicShelfView from "@/components/PublicShelfView";
import { useAuth } from "@/lib/auth";
import {
  useCollectionSummary,
  useGallerySharing,
  useMyFavorites,
  useMyOwned,
  useMyShelf,
  useSiteBobbleheadCounts,
} from "@/lib/profile";
import type { PublicGalleryItem } from "@/lib/publicShelf";
import { computeShelfStats } from "@/lib/shelfStats";

// An owner-only preview of the public /shelf/<slug> page. It renders the exact
// same PublicShelfView the live page uses, but from the signed-in user's own
// data (readable via the owner RLS policies) rather than the public RPCs — so it
// works even while the shelf is private, which is the whole point: seeing what
// you'd be sharing before you flip it public. Everything is assembled to match
// get_public_shelf / get_public_gallery so the preview can't drift from reality.
export function ShelfPreviewClient() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const sharing = useMyShelf();
  const collection = useCollectionSummary();
  const site = useSiteBobbleheadCounts();
  const gallery = useGallerySharing();
  const ownedResult = useMyOwned();
  const favoritesResult = useMyFavorites();

  const { shelf } = sharing;

  // The gallery is gated exactly like the live page: shown only when the shelf
  // is public AND the owner turned the gallery on (is_public AND gallery_public).
  // While the shelf is private the public sees nothing, so the preview mirrors
  // that by staying counts-only until sharing is actually on.
  const showGallery = shelf.isPublic && gallery.enabled;
  const galleryItems: PublicGalleryItem[] = showGallery
    ? [
        ...ownedResult.owned.map((item) => ({ kind: "owned" as const, ...item })),
        ...favoritesResult.favorites.map((item) => ({ kind: "favorite" as const, ...item })),
      ]
    : [];

  const stats = computeShelfStats(collection.countByTeamSlug, site.totalByTeamSlug);

  const isLoading =
    isAuthLoading ||
    (Boolean(user) &&
      (sharing.isLoading ||
        collection.isLoading ||
        site.isLoading ||
        gallery.isLoading ||
        (showGallery && (ownedResult.isLoading || favoritesResult.isLoading))));

  if (isAuthLoading) return null;

  if (!user) {
    return (
      <div
        className="flex min-h-full flex-1 flex-col items-center justify-center gap-3 px-4 pb-24 text-center"
        style={{ background: "var(--page-gradient)" }}
      >
        <h1 className="text-lg font-black text-zinc-900 dark:text-white">Sign in to preview your shelf</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Log in to see what your public shelf looks like.
        </p>
        <Link
          href="/settings"
          className="mt-2 text-sm font-semibold text-accent transition hover:text-accent-hover"
        >
          ← Back to settings
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Fixed to the top so it's clear throughout that this is a preview and not
          the live page, and whether the shelf is actually public yet. */}
      <div className="sticky top-0 z-10 border-b border-black/10 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-[#0a1420]/85">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2.5 sm:px-6">
          <Link
            href="/settings"
            className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 transition hover:text-accent-hover dark:text-zinc-300 dark:hover:text-accent-hover"
          >
            <span aria-hidden>←</span> Settings
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex-shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-accent">
              Preview
            </span>
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              {shelf.isPublic
                ? "Live — exactly what anyone with your link sees."
                : "Private — this is what the public would see if you turn sharing on."}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div
          className="flex flex-1 items-center justify-center px-4 pb-24 pt-10"
          style={{ background: "var(--page-gradient)" }}
        >
          <p className="text-sm font-semibold text-zinc-500">Building your preview…</p>
        </div>
      ) : (
        <PublicShelfView
          displayName={shelf.displayName}
          countByTeamSlug={collection.countByTeamSlug}
          totalByTeamSlug={site.totalByTeamSlug}
          stats={stats}
          galleryItems={galleryItems}
        />
      )}
    </div>
  );
}
