"use client";

import { useState, useSyncExternalStore } from "react";
import { profileWelcomeSeenKey } from "@/components/ProfileWelcomeModal";

// A one-time heads-up that the awards shelf exists, for members who were
// already here before it did.
//
// It exists because the profile tour is shown once and then never again: every
// member who joined before awards shipped has already dismissed it, so the
// tour's new "Earn awards" row reaches nobody but new signups. Rather than
// re-run the whole tour for everyone — an intrusive popup for people who have
// used the site for months — this says the one new thing and gets out of the
// way.
//
// Whether it's been dismissed lives on the account (profiles.awards_intro_ack_at,
// see supabase/awards_intro_ack.sql), not in localStorage. A device-local flag
// would make "once" a property of a browser: dismiss it on a laptop and it
// still shows up on the phone, which is the nag this banner exists to avoid.
//
// Whether the member has taken the profile tour is still device-local, and
// that's correct — it's the modal's own state, and it only gates this banner so
// the two don't appear on screen together.
//
// localStorage is external mutable state, so useSyncExternalStore reads it the
// way React intends: it returns "not seen" during SSR and the first client
// render, then re-renders once from the real snapshot. Reading it in a useState
// initializer instead is a hydration mismatch — the server renders nothing and
// the client renders a banner. The flag never changes for other reasons while
// the page is mounted, so subscribe is a no-op.
const noopSubscribe = () => () => {};

export function AwardsIntroBanner({
  userId,
  acknowledged,
  onAcknowledge,
}: {
  userId: string;
  /** From the account. Null while it's still loading, which renders nothing —
   *  "don't know yet" must not look like "hasn't seen it". */
  acknowledged: boolean | null;
  onAcknowledge: () => void;
}) {
  // The tour covers awards itself now, so anyone who hasn't taken it is about
  // to be told there. Telling them twice in two different ways — and stacking a
  // banner under the open modal — is worse than not telling them here.
  const hasTakenTour = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return window.localStorage.getItem(profileWelcomeSeenKey(userId)) !== null;
      } catch {
        // Storage unavailable: the modal can't track itself either, so it will
        // show. Stay out of its way.
        return false;
      }
    },
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);

  if (acknowledged !== false || !hasTakenTour || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    onAcknowledge();
  };

  return (
    // z-40 keeps it under the award celebration modal (z-50). The two can
    // coincide — clear a milestone and land here on the same visit — and a
    // banner floating over that modal's dimmed backdrop looks like a bug.
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto w-full max-w-md rounded-lg border border-accent/50 bg-white p-4 shadow-2xl backdrop-blur"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-black uppercase tracking-wide text-accent">
            {/* `{" "}` not a plain space, same as RepWelcomeBanner: this
                Next version's JSX transform strips the leading space off the
                following text node, jamming the trophy against the words. */}
            <span aria-hidden>🏆</span>{" "}
            New: awards
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 rounded p-1 text-lg leading-none text-zinc-400 transition hover:text-zinc-700"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-700">
          Your shelf now has an awards wall — for the size of your collection, the teams
          you&apos;ve started, and the ones you&apos;ve finished.{" "}
          <span className="font-semibold text-zinc-900">
            You&apos;ve already earned some.
          </span>
        </p>
        <div className="mt-3 flex items-center gap-4">
          <a
            href="#awards"
            onClick={(event) => {
              dismiss();
              // Same smooth scroll as the section nav above, rather than the
              // browser's jump — and it still works if the hash doesn't change.
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              document.getElementById("awards")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center rounded bg-accent px-3 py-1.5 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover"
          >
            See my awards
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-bold text-zinc-500 transition hover:text-zinc-800"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
