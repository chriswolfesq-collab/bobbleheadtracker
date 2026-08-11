"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminModeBadge } from "@/components/AdminModeBadge";
import { AuthWidget } from "@/components/AuthWidget";
import { SiteSearch } from "@/components/SiteSearch";

// Routes that must render without the global header/footer. /settings/preview
// is captured with html-to-image for shelf sharing; chrome would end up in the
// exported picture.
const CHROMELESS_ROUTES = ["/settings/preview"];

function isChromeless(pathname: string): boolean {
  return CHROMELESS_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={`font-display text-xl font-bold uppercase tracking-wide ${className ?? ""}`}
    >
      <span className="text-navy">Bobble</span>
      <span className="text-accent-hover">Shelf</span>
    </span>
  );
}

// The top-level destinations. /profile is the signed-in user's own collection;
// signed out it renders its own sign-in prompt, so the link is safe to show to
// everyone and doubles as the pitch for making an account.
const PRIMARY_NAV = [
  { href: "/teams", label: "Teams" },
  { href: "/tags", label: "Tags" },
  { href: "/recently-added", label: "Recently Added" },
  { href: "/upcoming", label: "Upcoming" },
  { href: "/profile", label: "My Shelf" },
];

function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Navigating away closes the panel — including navigations that don't start
  // in it, like a search result or the wordmark. Adjusting state during render
  // rather than in an effect keeps it to one render pass; the panel's own links
  // also close it directly, since tapping the link for the page you're already
  // on leaves the pathname unchanged.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setIsMenuOpen(false);
  }

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  if (isChromeless(pathname)) {
    return null;
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-border-soft bg-background/95 backdrop-blur"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-1.5 focus:text-sm focus:text-accent-fg"
      >
        Skip to content
      </a>
      {/* h-14 is load-bearing: the bobblehead detail pages pin their own sub-nav
          bar at top-14. The row keeps that height at every breakpoint — below
          lg the nav collapses into a menu that opens as an overlay panel rather
          than a second row. */}
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 lg:gap-6">
          <button
            type="button"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls="site-menu"
            onClick={() => setIsMenuOpen((current) => !current)}
            className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded text-navy transition hover:text-accent-hover lg:hidden"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              className="h-5 w-5"
            >
              {isMenuOpen ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>
          <Link href="/" aria-label="BobbleShelf home" className="shrink-0">
            <Wordmark />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-5 lg:flex">
            {PRIMARY_NAV.map((link) => {
              const active = isNavActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap text-xs font-black uppercase tracking-wide transition ${
                    active ? "text-accent" : "text-zinc-600 hover:text-accent-hover"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {/* min-w-0 lets this cluster shrink instead of pushing past the
            viewport; each control collapses to its icon on narrow screens so
            all three still fit next to the wordmark at 320px. */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <SiteSearch variant="inline" compact />
          <AdminModeBadge />
          <AuthWidget />
        </div>
      </div>

      {isMenuOpen ? (
        <nav
          id="site-menu"
          aria-label="Menu"
          className="absolute inset-x-0 top-full border-b border-border-soft bg-surface shadow-lg lg:hidden"
        >
          <div className="mx-auto w-full max-w-6xl px-2 py-1.5 sm:px-4">
            {PRIMARY_NAV.map((link) => {
              const active = isNavActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setIsMenuOpen(false)}
                  className={`block rounded px-2 py-3 text-sm font-black uppercase tracking-wide transition hover:bg-black/[0.06] ${
                    active ? "text-accent" : "text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/become-a-rep", label: "Become a Team Rep" },
  { href: "/refer", label: "Refer a Friend" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "FAQ" },
  { href: "/community-guidelines", label: "Community Guidelines" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

export function SiteFooter() {
  const pathname = usePathname();
  if (isChromeless(pathname)) {
    return null;
  }

  return (
    <footer className="mt-auto bg-navy text-accent-fg">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
        <span className="font-display text-lg font-bold uppercase tracking-wide">
          <span className="text-accent-fg">Bobble</span>
          <span className="text-brass-light">Shelf</span>
        </span>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-accent-fg/80 transition hover:text-accent-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-accent-fg/60">
          © {new Date().getFullYear()} BobbleShelf
        </p>
      </div>
    </footer>
  );
}
