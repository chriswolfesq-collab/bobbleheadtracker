import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Privacy Policy — BobbleShelf",
  description: "What data BobbleShelf collects and how it's used.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <BreadcrumbJsonLd trail={[{ name: "Privacy Policy", path: "/privacy" }]} />
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <Breadcrumbs
          className="mb-6"
          items={[{ href: "/", label: "Home" }, { label: "Privacy Policy" }]}
        />
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-navy">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated July 28, 2026</p>
        <div className="mt-6 space-y-5 rounded-xl border border-border-soft bg-surface p-6 text-sm leading-7 text-zinc-700">
          <section>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
              What we collect
            </h2>
            <p className="mt-1">
              An account stores your email address, display name, and the collection data you
              create: owned, wanted, and favorited bobbleheads, plus any listings, photos, and
              reports you submit.
            </p>
          </section>
          <section>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
              How it&apos;s used
            </h2>
            <p className="mt-1">
              Your email is used to sign you in and — only if you turn on email alerts — to
              notify you about bobbleheads on your wanted list. Your display name appears next
              to content you share publicly, such as a public shelf or submitted photos.
            </p>
          </section>
          <section>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
              What&apos;s public
            </h2>
            <p className="mt-1">
              Nothing is public by default. Your shelf becomes public only if you enable sharing
              in Settings, and you can turn it off at any time. Approved photo submissions are
              shown publicly next to their listing.
            </p>
          </section>
          <section>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
              What we don&apos;t do
            </h2>
            <p className="mt-1">
              We don&apos;t sell your data, and we don&apos;t share it with third parties beyond
              the infrastructure that runs the site (hosting, database, and basic anonymous
              analytics).
            </p>
          </section>
          <section>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
              Removing your data
            </h2>
            <p className="mt-1">
              Want your account or a submitted photo removed? Reach out via the{" "}
              <Link href="/contact" className="font-semibold text-accent hover:text-accent-hover">
                contact page
              </Link>{" "}
              and we&apos;ll take care of it.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
