import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — MLB Bobblehead Collection",
};

export default function TermsPage() {
  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          href="/"
          className="text-xs font-bold uppercase tracking-wide text-accent hover:text-accent-hover"
        >
          ← Back home
        </Link>

        <h1 className="mt-4 text-2xl font-black text-zinc-900 sm:text-3xl dark:text-white">Terms of Service</h1>
        <p className="mt-2 text-xs text-zinc-500">Last updated July 16, 2026</p>

        <div className="mt-8 grid gap-6 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          <section>
            <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-accent">
              1. Acceptance of terms
            </h2>
            <p>
              By creating an account or using MLB Bobblehead Collection (&quot;the service&quot;), you agree
              to these Terms of Service. If you do not agree, please do not create an account or
              use the service.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-accent">
              2. Your account
            </h2>
            <p>
              You&apos;re responsible for keeping your login credentials secure and for all
              activity that happens under your account. Let us know right away if you suspect
              unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-accent">
              3. Content you submit
            </h2>
            <p>
              When you submit photos, listings, reports, or other content, you confirm you have
              the right to share it and grant us permission to display it within the service. We
              may remove content that violates these terms or applicable law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-accent">
              4. Acceptable use
            </h2>
            <p>
              Don&apos;t misuse the service — no scraping at scale, harassment, impersonation, or
              attempts to disrupt or gain unauthorized access to the site or other users&apos;
              accounts.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-accent">
              5. Disclaimer
            </h2>
            <p>
              This is a fan-run collection tracker and is not affiliated with Major League
              Baseball or any team. The service is provided &quot;as is,&quot; without warranties of any
              kind.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-accent">
              6. Changes
            </h2>
            <p>
              We may update these terms from time to time. Continued use of the service after
              changes take effect means you accept the updated terms.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-accent">
              7. Contact
            </h2>
            <p>Questions about these terms? Reach out through the site&apos;s contact options.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
