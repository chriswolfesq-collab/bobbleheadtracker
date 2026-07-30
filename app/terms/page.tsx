import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — BobbleShelf",
  description: "The terms you agree to when you use BobbleShelf.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-navy">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated July 16, 2026</p>
        <div className="mt-6 space-y-5 rounded-xl border border-border-soft bg-surface p-6 text-sm leading-7 text-zinc-700">
          <section>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
              1. Acceptance of terms
            </h2>
            <p className="mt-1">
              By creating an account or using BobbleShelf (&quot;the service&quot;), you agree to
              these Terms of Service. If you do not agree, please do not create an account or use
              the service.
            </p>
          </section>
          <section>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
              2. Your account
            </h2>
            <p className="mt-1">
              You&apos;re responsible for keeping your login credentials secure and for all
              activity that happens under your account. Let us know right away if you suspect
              unauthorized use.
            </p>
          </section>
          <section>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
              3. Content you submit
            </h2>
            <p className="mt-1">
              When you submit photos, listings, reports, or other content, you confirm you have
              the right to share it and grant us permission to display it within the service. We
              may remove content that violates these terms or applicable law.
            </p>
          </section>
          <section>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
              4. Acceptable use
            </h2>
            <p className="mt-1">
              Don&apos;t misuse the service — no scraping at scale, harassment, impersonation, or
              attempts to disrupt or gain unauthorized access to the site or other users&apos;
              accounts.
            </p>
          </section>
          <section>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
              5. Disclaimer
            </h2>
            <p className="mt-1">
              BobbleShelf is a fan-run collection tracker and is not affiliated with Major League
              Baseball or any team. The service is provided &quot;as is,&quot; without warranties
              of any kind.
            </p>
          </section>
          <section>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
              6. Changes
            </h2>
            <p className="mt-1">
              We may update these terms from time to time. Continued use of the service after
              changes take effect means you accept the updated terms.
            </p>
          </section>
          <section>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
              7. Contact
            </h2>
            <p className="mt-1">
              Questions about these terms? Reach out via the{" "}
              <Link href="/contact" className="font-semibold text-accent hover:text-accent-hover">
                contact page
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
