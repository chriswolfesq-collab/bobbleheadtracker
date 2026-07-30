import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "About — BobbleShelf",
  description:
    "BobbleShelf is the most comprehensive database of MLB stadium giveaway bobbleheads, built by collectors, for collectors.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <BreadcrumbJsonLd trail={[{ name: "About", path: "/about" }]} />
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <Breadcrumbs className="mb-6" items={[{ href: "/", label: "Home" }, { label: "About" }]} />
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-navy">About</h1>
        <div className="mt-6 space-y-4 rounded-xl border border-border-soft bg-surface p-6 text-sm leading-7 text-zinc-700">
          <p>
            BobbleShelf is the most comprehensive database of MLB stadium giveaway (SGA)
            bobbleheads — every team, every giveaway, in one place.
          </p>
          <p>
            It&apos;s built by collectors, for collectors. Browse all 30 teams, mark off the
            bobbleheads you own, keep a wishlist, share your shelf, and help the community by
            submitting photos and listings we&apos;re missing.
          </p>
          <p>
            Spot an error? Every bobblehead page has a &ldquo;Submit an Update&rdquo; button —
            reports go straight to the site admin.
          </p>
        </div>
      </div>
    </div>
  );
}
