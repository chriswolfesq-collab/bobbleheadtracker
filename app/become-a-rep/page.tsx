import type { Metadata } from "next";
import Link from "next/link";
import { InboundMessageForm } from "@/components/InboundMessageForm";
import { TEAMS } from "@/lib/teams";

const title = "Become a Team Rep — BobbleShelf";
const description =
  "Team reps keep one team's bobblehead checklist accurate — fixing listings, approving photos, and reviewing what other collectors send in. Apply to rep your team.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/become-a-rep" },
  openGraph: { title, description, type: "website", url: "/become-a-rep" },
  twitter: { card: "summary_large_image", title, description },
};

// What a rep can actually do, kept in step with the welcome email the
// notify-team-rep Edge Function sends once someone is assigned.
const POWERS = [
  {
    title: "Fix any listing",
    body: "Edit a name, date, photo or quantity on your team's page when it's wrong or missing.",
  },
  {
    title: "Review submissions",
    body: "Approve or turn down the photos and new bobbleheads other collectors send in for your team.",
  },
  {
    title: "Resolve reports",
    body: "Act on reports that one of your team's listings has bad information.",
  },
];

export default async function BecomeARepPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team } = await searchParams;
  // Validated against the real team list rather than trusted: this lands in a
  // <select> value, and an unknown slug would silently select nothing and make
  // the form look broken.
  const defaultTeamSlug = TEAMS.some((t) => t.slug === team) ? team : undefined;

  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-navy">
          Become a Team Rep
        </h1>
        <p className="mt-3 text-sm leading-7 text-zinc-700">
          Every team&apos;s checklist is only as good as the collectors watching it. A team rep gets
          the same editing tools the site admin has, fenced to a single team — so the person who
          knows that team&apos;s giveaways best is the one keeping its page right.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {POWERS.map((power) => (
            <div key={power.title} className="rounded-xl border border-border-soft bg-surface p-5">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-navy">
                {power.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{power.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-border-soft bg-surface p-6 text-sm leading-7 text-zinc-700">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-navy">
            What we&apos;re looking for
          </h2>
          <p className="mt-2">
            You collect the team, you know its giveaway history, and you&apos;ll notice when
            something on the page is off. That&apos;s it — there&apos;s no time commitment and no
            quota. Tell us a bit about your collection and why you want the team.
          </p>
          <p className="mt-3">
            Rep access is turned on for the email address you apply with, so use the one on your{" "}
            <Link href="/settings" className="font-semibold text-accent hover:text-accent-hover">
              BobbleShelf account
            </Link>{" "}
            if you already have one. If you don&apos;t, you can sign up after you&apos;re approved.
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-border-soft bg-surface p-6">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-navy">
            Apply
          </h2>
          <p className="mb-5 mt-1 text-sm text-zinc-600">
            We read every application and reply by email.
          </p>
          <InboundMessageForm
            kind="rep_application"
            defaultTeamSlug={defaultTeamSlug}
            messageLabel="Why this team?"
            messagePlaceholder="How long you've collected them, roughly how many you have, anything else we should know…"
            submitLabel="Send application"
          />
        </div>
      </div>
    </div>
  );
}
