"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ListingNav, ListingNavEntry } from "@/lib/listingNav";

/**
 * The list a reader was working through when they opened a listing, so the
 * detail page's prev/next arrows walk THAT list instead of the team chain.
 *
 * The server-built chain (lib/listingNav.ts) is always one team's catalog in
 * release order. That's the right default — it's what a crawler should follow,
 * and it's what someone browsing a team page expects — but it's disorienting
 * everywhere else: arrowing out of the third card on Recently Added dropped you
 * into the Mariners catalog, and every listing that happened to be its team's
 * newest showed no back arrow at all because it was position 1 of a chain the
 * reader never asked for.
 *
 * Kept in sessionStorage rather than the URL. The trail can be hundreds of
 * entries, it's per-tab by nature, and — the reason it matters here — the detail
 * pages are prerendered long-tail landing pages, so the arrows have to render
 * from the server chain first and be upgraded after mount. A crawler, a
 * bookmark, or an arrival from Google finds no trail and keeps the team chain.
 */

const STORAGE_KEY = "bobbleshelf:listing-trail";

// A longer list is stored as a window centered on the card that was clicked.
// Search matches several thousand listings on a broad query and nobody arrows
// through 2,000 of them, but truncating from the head would strand a click deep
// in the results with no chain at all.
const TRAIL_MAX = 2000;

export type ListingTrail = {
  /** what the reader sees in the counter — "Recently Added", a tag name, a team */
  label: string;
  entries: ListingNavEntry[];
};

/**
 * Record the list being left. Called from the card's own click handler rather
 * than on render: the filtered lists behind these pages change on every
 * keystroke, and serializing hundreds of entries per keystroke to store a list
 * nobody clicked is pure waste.
 */
export function saveListingTrail(
  label: string,
  entries: ListingNavEntry[],
  clickedIndex: number,
): void {
  if (typeof window === "undefined") return;

  let window_ = entries;
  if (entries.length > TRAIL_MAX) {
    const start = Math.max(
      0,
      Math.min(clickedIndex - Math.floor(TRAIL_MAX / 2), entries.length - TRAIL_MAX),
    );
    window_ = entries.slice(start, start + TRAIL_MAX);
  }

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ label, entries: window_ }));
  } catch {
    // Full, disabled, or partitioned storage just means the arrows keep
    // following the team chain. Not worth breaking the click over.
  }
}

function readListingTrail(): ListingTrail | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const trail = parsed as ListingTrail;
    if (typeof trail.label !== "string" || !Array.isArray(trail.entries)) return null;
    return trail;
  } catch {
    return null;
  }
}

// Community ids are percent-encoded into their hrefs, and the browser hands
// back the encoded pathname. Compare decoded so the two spellings of the same
// listing match.
function normalizePath(href: string): string {
  const [path] = href.split("?");
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * The nav a trail implies for one listing, or null when the trail doesn't
 * contain it — exported for the tests; the hook below is the way to use it.
 */
export function listingNavFromTrail(
  trail: ListingTrail | null,
  currentPath: string,
  fallback: ListingNav | null,
): ListingNav | null {
  if (!trail || trail.entries.length < 2) return null;

  const current = normalizePath(currentPath);
  const index = trail.entries.findIndex((entry) => normalizePath(entry.href) === current);
  if (index < 0) return null;

  return {
    // `related` stays on the server chain: those are crawlable "more from this
    // team" links, and a trail is neither crawlable nor about this team.
    related: fallback?.related ?? [],
    position: index + 1,
    total: trail.entries.length,
    prev: index > 0 ? trail.entries[index - 1] : null,
    next: index < trail.entries.length - 1 ? trail.entries[index + 1] : null,
    source: trail.label,
  };
}

/**
 * The chain this page should actually offer: the trail the reader arrived on
 * when there is one, the server-built team chain otherwise.
 *
 * Read in an effect rather than during render, for the same reason useTeamView
 * does it (lib/teamView.ts): touching sessionStorage during render of a
 * prerendered page is a hydration mismatch, and the server chain is the correct
 * thing to ship in the HTML regardless.
 */
export function useListingNav(fallback: ListingNav | null): ListingNav | null {
  const pathname = usePathname();
  const [trail, setTrail] = useState<ListingTrail | null>(null);

  useEffect(() => {
    // The pathname dependency re-reads after a prev/next transition, which
    // reuses this component and has to re-find its place in the trail. React
    // bails out of the re-render when there is no trail to find, which is the
    // common case (a crawler, a bookmark, an arrival from search).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrail(readListingTrail());
  }, [pathname]);

  // Merged during render rather than stored: `fallback` is a fresh object on
  // some of these pages, and an effect that depended on it would re-run — and
  // re-set state — on every render.
  return listingNavFromTrail(trail, pathname, fallback) ?? fallback;
}
