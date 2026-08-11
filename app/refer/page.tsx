import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ReferAFriend } from "@/components/ReferAFriend";

const title = "Refer a Friend — BobbleShelf";
const description =
  "Invite another collector to BobbleShelf. Share your personal link and every friend who joins through it is credited to you.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/refer" },
  openGraph: { title, description, type: "website", url: "/refer" },
  twitter: { card: "summary_large_image", title, description },
};

// How the site gets better, stated plainly. This is the honest pitch for
// referring someone even with no prize attached, and it stays true whatever the
// raffle ends up being.
const REASONS = [
  {
    title: "Better checklists",
    body: "Every collector who joins spots something the rest of us missed — a wrong date, a missing giveaway, a figure nobody had photographed.",
  },
  {
    title: "More photos",
    body: "Half the listings on the site came from someone's shelf. The more shelves, the fewer blank cards.",
  },
  {
    title: "Someone to trade with",
    body: "Wanted lists only work when there's someone on the other end holding the thing you're after.",
  },
];

export default function ReferPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <BreadcrumbJsonLd trail={[{ name: "Refer a Friend", path: "/refer" }]} />
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <Breadcrumbs
          className="mb-6"
          items={[{ href: "/", label: "Home" }, { label: "Refer a Friend" }]}
        />

        <ReferAFriend />

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {REASONS.map((reason) => (
            <div key={reason.title} className="rounded-xl border border-border-soft bg-surface p-5">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-navy">
                {reason.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{reason.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
