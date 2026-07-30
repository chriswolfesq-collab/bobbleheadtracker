"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function SiteHeader() {
  const pathname = usePathname();
  if (isChromeless(pathname)) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border-soft bg-background/95 backdrop-blur">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-1.5 focus:text-sm focus:text-accent-fg"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
        <Link href="/" aria-label="BobbleShelf home" className="shrink-0">
          <Wordmark />
        </Link>
        {/* min-w-0 lets this cluster shrink instead of pushing past the
            viewport; each control collapses to its icon on narrow screens so
            all three still fit next to the wordmark at 320px. */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <SiteSearch variant="inline" compact />
          <AdminModeBadge />
          <AuthWidget />
        </div>
      </div>
    </header>
  );
}

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
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
