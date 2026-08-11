"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { ListingNav } from "@/lib/listingNav";
import { withTeamView } from "@/lib/teamView";

const ARROW_CLASS =
  "fixed top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-border-soft bg-surface text-xl text-navy shadow-lg transition md:grid";
const ARROW_LIVE = "hover:border-accent hover:text-accent";
// Dimmed stand-in for the end of the chain. Dropping the arrow entirely read as
// a missing control rather than an edge — most obvious arriving from Recently
// Added, which lands you on the newest listing (position 1) often enough that
// the right arrow alone looked like a bug.
const ARROW_SPENT = "cursor-default opacity-30";

/**
 * The prev/next edge arrows and the swipe gesture behind them, shared by the
 * curated and community detail pages so both ends of the chain behave the
 * same. The hrefs come from the nav entries because the two listing kinds live
 * under different routes.
 */
export function ListingNavControls({
  nav,
  teamView = "",
}: {
  nav: ListingNav;
  /** The team-page view the reader arrived from, handed along the chain so the
      team crumb still leads back to it after arrowing through listings. Empty
      until hydration on a prerendered page, which leaves the crawlable hrefs
      clean. */
  teamView?: string;
}) {
  const router = useRouter();
  const prevHref = nav.prev ? withTeamView(nav.prev.href, teamView) : null;
  const nextHref = nav.next ? withTeamView(nav.next.href, teamView) : null;

  // Left/right swipe moves between bobbleheads on touch screens, matching the
  // prev/next arrows. Vertical drags (scrolling) are ignored.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
    }
    function handleTouchEnd(event: TouchEvent) {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      if (dx < 0 && nextHref) router.push(nextHref);
      if (dx > 0 && prevHref) router.push(prevHref);
    }
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [prevHref, nextHref, router]);

  return (
    <>
      {prevHref ? (
        <Link
          href={prevHref}
          aria-label={`Previous: ${nav.prev?.title}`}
          title={nav.prev?.title}
          className={`left-2 ${ARROW_CLASS} ${ARROW_LIVE}`}
        >
          <span aria-hidden>‹</span>
        </Link>
      ) : (
        <span aria-hidden title="Newest for this team" className={`left-2 ${ARROW_CLASS} ${ARROW_SPENT}`}>
          ‹
        </span>
      )}
      {nextHref ? (
        <Link
          href={nextHref}
          aria-label={`Next: ${nav.next?.title}`}
          title={nav.next?.title}
          className={`right-2 ${ARROW_CLASS} ${ARROW_LIVE}`}
        >
          <span aria-hidden>›</span>
        </Link>
      ) : (
        <span aria-hidden title="Oldest for this team" className={`right-2 ${ARROW_CLASS} ${ARROW_SPENT}`}>
          ›
        </span>
      )}
    </>
  );
}

export function ListingNavCounter({ nav }: { nav: ListingNav }) {
  return (
    <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {nav.position} of {nav.total}
    </p>
  );
}
