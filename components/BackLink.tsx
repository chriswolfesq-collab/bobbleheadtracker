"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const TONE = {
  dark: "text-navy hover:text-accent-hover",
  light: "text-white hover:text-white/80",
};

/**
 * The "← Back" control that sits at the head of every breadcrumb trail.
 *
 * It goes back one page in history, which is what people mean when they reach
 * for a back button — the trail beside it already covers going *up*, and those
 * aren't the same trip once you've arrived sideways (from search, from a tag,
 * from the next bobblehead over). Rendered as a real link to the parent crumb
 * so it still works before hydration, opens in a new tab like any other link,
 * and lands somewhere sensible for arrivals with no history to pop: a bookmark,
 * a pasted URL, a shared link.
 */
export function BackLink({
  href,
  tone = "dark",
}: {
  /** Where to go when there's no previous page — normally the parent crumb. */
  href: string;
  tone?: "dark" | "light";
}) {
  const router = useRouter();

  return (
    <Link
      href={href}
      onClick={(event) => {
        // Leave modified clicks alone — those open a new tab, which has no
        // history of its own to go back through.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        // One entry deep means this tab landed here directly; fall through to
        // the href rather than trapping the reader on the page.
        if (window.history.length <= 1) return;
        event.preventDefault();
        router.back();
      }}
      className={`flex shrink-0 items-center gap-1.5 text-sm font-black uppercase tracking-wide transition ${TONE[tone]}`}
    >
      <span aria-hidden>←</span>
      Back
    </Link>
  );
}
