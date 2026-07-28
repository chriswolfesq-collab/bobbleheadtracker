import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Guidelines — BobbleShelf",
  description: "The ground rules for submitting listings, photos, and reports on BobbleShelf.",
  alternates: { canonical: "/community-guidelines" },
};

export default function CommunityGuidelinesPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-navy">
          Community Guidelines
        </h1>
        <div className="mt-6 space-y-4 rounded-xl border border-border-soft bg-surface p-6 text-sm leading-7 text-zinc-700">
          <p>
            BobbleShelf runs on community submissions. A few ground rules keep the catalog
            accurate and useful for everyone:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Stay on topic.</strong> MLB stadium giveaway bobbleheads only — no
              figurines, replicas, gnomes, or other promos.
            </li>
            <li>
              <strong>Submit accurate info.</strong> Double-check names, dates, and quantities
              before submitting. If you&apos;re unsure, mark it unknown.
            </li>
            <li>
              <strong>Only share photos you took or have the right to share.</strong> Photos you
              submit are shown publicly next to the listing.
            </li>
            <li>
              <strong>No duplicates.</strong> Search the team page before adding a bobblehead —
              variants belong in the descriptor field, not as new listings.
            </li>
            <li>
              <strong>Be constructive with reports.</strong> Reports go to a real person; tell us
              specifically what&apos;s wrong so it can be fixed.
            </li>
          </ul>
          <p>
            Submissions that break these rules may be removed, and repeat misuse can lead to
            account restrictions.
          </p>
        </div>
      </div>
    </div>
  );
}
