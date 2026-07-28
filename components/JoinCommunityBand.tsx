"use client";

import { useAuth } from "@/lib/auth";

// The homepage "Join the Community" call-to-action band. Renders nothing for
// signed-in users — they've already joined.
export function JoinCommunityBand() {
  const { user, isLoading, openAuthModal } = useAuth();

  if (isLoading || user) return null;

  return (
    <section
      aria-label="Join the community"
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
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-brass-light">
          Join the Community
        </h2>
        <p className="mt-1.5 max-w-md text-sm leading-6 text-accent-fg/85">
          Create an account to track your collection, contribute photos and
          connect with collectors like you.
        </p>
      </div>
      <button
        type="button"
        onClick={() => openAuthModal("sign-up")}
        className="shrink-0 rounded-lg bg-brass-light px-7 py-3 font-display text-sm font-bold uppercase tracking-wider text-navy-deep transition hover:brightness-110"
      >
        Sign Up Free
      </button>
    </section>
  );
}
