"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The team page keeps its tab/filter/sort/page state in the URL (see
 * BobbleheadCollection). Clicking a card leaves that page, and the detail
 * page's team crumb used to point at a bare `/teams/[slug]` — dropping someone
 * who was on page 4 of the Yankees back at page 1 of an unfiltered list. So the
 * card links carry the view they came from as `?from=<query>`, and the detail
 * page rebuilds the team crumb from it.
 *
 * The `from` value is a query string, never a path: the crumb is always
 * `/teams/[slug]`, and only the keys below survive the round trip, so a
 * hand-edited link can't redirect anyone anywhere.
 */
const TEAM_VIEW_KEYS = ["tab", "sort", "year", "city", "photo", "favorites", "page"] as const;

/** Keep only the team page's own view keys, in a stable order. */
export function teamViewQuery(search: string): string {
  const source = new URLSearchParams(search);
  const params = new URLSearchParams();
  for (const key of TEAM_VIEW_KEYS) {
    const value = source.get(key);
    if (value) params.set(key, value);
  }
  return params.toString();
}

/** Merge a fresh team view into a URL's other params, replacing the old one. */
export function mergeTeamViewQuery(search: string, view: string): string {
  const params = new URLSearchParams(search);
  for (const key of TEAM_VIEW_KEYS) params.delete(key);
  for (const [key, value] of new URLSearchParams(view)) params.set(key, value);
  return params.toString();
}

/** A listing link that carries the team view the reader is leaving. */
export function withTeamView(href: string, view: string): string {
  if (!view) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}from=${encodeURIComponent(view)}`;
}

/** The team page to return to — page 4 of the Yankees, not page 1. */
export function teamHrefFromView(teamSlug: string, view: string): string {
  return view ? `/teams/${teamSlug}?${view}` : `/teams/${teamSlug}`;
}

/**
 * The team view a detail page was reached from, read from the URL after mount.
 *
 * Deliberately not `useSearchParams`: these ~3,600 detail pages are prerendered
 * long-tail landing pages, and reading search params during render would push
 * the whole client tree below them into client-side rendering. Reading
 * `window.location` in an effect keeps the prerendered HTML intact — the crumb
 * points at the plain team page until hydration upgrades it, which is also
 * exactly what a crawler should follow. The pathname dependency re-reads it
 * after a prev/next transition, which may reuse this component.
 */
export function useTeamView(): string {
  const pathname = usePathname();
  const [view, setView] = useState("");

  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get("from") ?? "";
    // The URL is the external system here: state initializers can't read
    // window on the server, so the read has to happen after mount. React bails
    // out of the re-render when there's no `from` to find, which is the common
    // case (a crawler, a bookmark, an arrival from search).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(teamViewQuery(from));
  }, [pathname]);

  return view;
}
