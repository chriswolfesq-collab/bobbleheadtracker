import Link from "next/link";

import { BackLink } from "./BackLink";

export type Crumb = {
  /** Omit on the final crumb — the current page isn't a link to itself. */
  href?: string;
  label: string;
};

const TONE = {
  dark: {
    link: "text-zinc-600 hover:text-accent-hover",
    current: "font-semibold text-navy",
    separator: "text-zinc-400",
  },
  light: {
    link: "text-white/75 hover:text-white",
    current: "font-semibold text-white",
    separator: "text-white/40",
  },
};

/**
 * ← Back | Home › Teams › Yankees › George Costanza.
 *
 * The back button leads every trail: the crumbs move you *up* the hierarchy,
 * the button moves you *back* one page, and those aren't the same trip once
 * you've arrived sideways (from search, from a tag, from another bobblehead).
 * Its href is the parent crumb, which is where a reader with no history to pop
 * would have gone anyway.
 *
 * Below `sm` everything but the last two crumbs drops out: a four-level trail
 * doesn't fit a phone next to the controls that share its row, and the two that
 * survive (parent + current page) are the ones that actually orient you. The
 * matching BreadcrumbList JSON-LD lives on each route's server component, where
 * it can use absolute URLs.
 */
export function Breadcrumbs({
  items,
  tone = "dark",
  className,
}: {
  items: Crumb[];
  /** `light` is for the team hero's colored gradient; `dark` for the cream page. */
  tone?: "dark" | "light";
  className?: string;
}) {
  const styles = TONE[tone];
  // Index of the first crumb that stays visible on a phone.
  const firstVisible = Math.max(items.length - 2, 0);
  // The deepest ancestor that's actually a link — the current page never is.
  const ancestors = items.slice(0, -1).filter((item) => item.href);
  const backHref = ancestors.length > 0 ? ancestors[ancestors.length - 1].href! : "/";

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex min-w-0 items-center gap-3 sm:gap-4 ${className ?? ""}`}
    >
      <BackLink href={backHref} tone={tone} />
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={item.href ?? item.label}
              className={`min-w-0 items-center gap-1.5 ${
                index < firstVisible ? "hidden sm:flex" : "flex"
              }`}
            >
              {index > 0 ? (
                <span
                  aria-hidden
                  // The first crumb showing on a phone has nothing before it,
                  // so its separator would dangle at the start of the row.
                  className={`shrink-0 ${styles.separator} ${
                    index === firstVisible ? "hidden sm:inline" : ""
                  }`}
                >
                  ›
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link href={item.href} className={`truncate transition ${styles.link}`}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className={`truncate ${styles.current}`}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
