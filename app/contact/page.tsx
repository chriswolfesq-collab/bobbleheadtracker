import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact — BobbleShelf",
  description: "How to reach BobbleShelf with questions, corrections, or takedown requests.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-navy">Contact</h1>
        <div className="mt-6 space-y-4 rounded-xl border border-border-soft bg-surface p-6 text-sm leading-7 text-zinc-700">
          <p>
            The fastest way to fix a listing is the <strong>Submit an Update</strong> button on
            that bobblehead&apos;s page — reports go straight to the admin queue.
          </p>
          <p>
            Have a photo to share? Use <strong>Add photos</strong> on the bobblehead&apos;s page,
            or submit a missing bobblehead from its team page.
          </p>
          <p>
            For anything else — account questions, photo takedown requests, or general feedback —
            email{" "}
            <a href="mailto:chriswolfesq@gmail.com" className="font-semibold text-accent hover:text-accent-hover">
              chriswolfesq@gmail.com
            </a>
            .
          </p>
          <p>
            See also the <Link href="/terms" className="font-semibold text-accent hover:text-accent-hover">Terms of Service</Link>{" "}
            and <Link href="/privacy" className="font-semibold text-accent hover:text-accent-hover">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
