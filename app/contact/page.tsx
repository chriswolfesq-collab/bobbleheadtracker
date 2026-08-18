import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { InboundMessageForm } from "@/components/InboundMessageForm";

export const metadata: Metadata = {
  title: "Contact — BobbleShelf",
  description: "How to reach BobbleShelf with questions, corrections, or takedown requests.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <BreadcrumbJsonLd trail={[{ name: "Contact", path: "/contact" }]} />
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <Breadcrumbs className="mb-6" items={[{ href: "/", label: "Home" }, { label: "Contact" }]} />
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-navy">Contact</h1>
        <div className="mt-6 space-y-4 rounded-xl border border-border-soft bg-surface p-6 text-sm leading-7 text-zinc-700">
          {/* The `{" "}` after each </strong> is load-bearing: this Next
              version's JSX transform strips the leading space from any text
              node that contains an HTML entity (&apos; here), so a plain space
              would vanish and render as "Updatebutton". */}
          <p>
            The fastest way to fix a listing is the <strong>Submit an Update</strong>{" "}
            button on that bobblehead&apos;s page — reports go straight to the admin queue.
          </p>
          <p>
            Have a photo to share? Use <strong>Add photos</strong>{" "}
            on the bobblehead&apos;s page, or submit a missing bobblehead from its team page.
          </p>
          <p>
            For anything else — account questions, photo takedown requests, or general feedback —
            send a message below. Signed in, it becomes a thread in your{" "}
            <Link href="/inbox" className="font-semibold text-accent hover:text-accent-hover">inbox</Link>{" "}
            and we reply there; signed out, we reply to the email address you give us.
          </p>
          <p>
            See also the <Link href="/terms" className="font-semibold text-accent hover:text-accent-hover">Terms of Service</Link>{" "}
            and <Link href="/privacy" className="font-semibold text-accent hover:text-accent-hover">Privacy Policy</Link>.
          </p>
        </div>

        {/* A form rather than a mailto: link. The address it used to publish was
            a personal one, and putting it in the markup meant handing it to
            every scraper that walked the site. This posts to inbound_messages,
            which emails the admins with reply-to set to the sender — so replying
            is still just Reply, without the address being public. */}
        <div className="mt-8 rounded-xl border border-border-soft bg-surface p-6">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-navy">
            Send a message
          </h2>
          <p className="mb-5 mt-1 text-sm text-zinc-600">
            We read everything that comes in, and we reply.
          </p>
          <InboundMessageForm
            kind="contact"
            allowSignedInThread
            messageLabel="How can we help?"
            messagePlaceholder="Tell us what's going on…"
            submitLabel="Send message"
          />
        </div>
      </div>
    </div>
  );
}
