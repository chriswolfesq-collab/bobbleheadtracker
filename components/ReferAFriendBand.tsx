"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

// The homepage "Refer a Friend" call-to-action band. The mirror image of
// JoinCommunityBand: that one pitches signing up and hides once you have, this
// one appears at that point and pitches bringing someone else in. Only ever one
// of the two is on the page.
//
// A teaser, not the widget — the invite link, the counts and the share sheet
// all live at /refer. Putting them here would mean every homepage visit pays
// for an RPC that most visitors won't act on.
export function ReferAFriendBand() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) return null;

  return (
    <section
      aria-label="Refer a friend"
      className="flex flex-col items-start gap-5 rounded-2xl bg-navy-deep px-7 py-7 shadow-lg sm:flex-row sm:items-center sm:px-9"
    >
      <span aria-hidden className="shrink-0 text-brass-light">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-14 w-14"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <path d="M20 8v6M23 11h-6" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-brass-light">
          Refer a Friend
        </h2>
        <p className="mt-1.5 max-w-md text-sm leading-6 text-accent-fg/85">
          Know someone with a shelf full of these? Send them your link — every collector who
          joins through it is credited to you.
        </p>
      </div>
      <Link
        href="/refer"
        className="shrink-0 rounded-lg bg-brass-light px-7 py-3 font-display text-sm font-bold uppercase tracking-wider text-navy-deep transition hover:brightness-110"
      >
        Get My Link
      </Link>
    </section>
  );
}
