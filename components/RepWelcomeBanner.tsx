"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { TEAMS } from "@/lib/teams";

// Shown once to a team rep after they're promoted: a friendly heads-up in the
// app to go with the welcome email, pointing them at their new powers. Full
// admins never see it (isRep is false for them).
//
// "Once" is keyed on the exact set of teams they can edit, stored in
// localStorage. Dismissing acknowledges that set; if they're later made rep of
// another team the set changes and the banner returns for the new grant. There
// is no notifications table — this is deliberately client-only state.
const ACK_KEY = "bobbleshelf-rep-welcome-ack";

const teamName = (slug: string) => TEAMS.find((t) => t.slug === slug)?.name ?? slug;

function teamsKey(slugs: string[]): string {
  return [...slugs].sort().join(",");
}

export function RepWelcomeBanner() {
  const { isRep, editableTeams, isLoading } = useAdminAuth();
  // Read on the client only (null during SSR). The isRep/isLoading gate below
  // means the first client render also produces nothing until the admin check
  // resolves, so there's no hydration mismatch and no dismissed-banner flash.
  const [acknowledged, setAcknowledged] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(ACK_KEY) ?? "";
    } catch {
      return "";
    }
  });

  if (isLoading || !isRep || editableTeams.length === 0 || acknowledged === null) {
    return null;
  }

  const currentKey = teamsKey(editableTeams);
  if (acknowledged === currentKey) {
    return null;
  }

  const dismiss = () => {
    try {
      localStorage.setItem(ACK_KEY, currentKey);
    } catch {
      // If storage is unavailable, just hide it for this session.
    }
    setAcknowledged(currentKey);
  };

  const teamLabel = editableTeams.map(teamName).join(", ");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto w-full max-w-md rounded-lg border border-accent/50 bg-white p-4 shadow-2xl backdrop-blur dark:bg-[#0b1a29]"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-black uppercase tracking-wide text-accent">
            <span aria-hidden>⚙</span> You&apos;re a team rep
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 rounded p-1 text-lg leading-none text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          You can now edit{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{teamLabel}</span> — fix
          bobblehead details, review submissions, and resolve listing reports for your team.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <Link
            href="/admin"
            onClick={dismiss}
            className="inline-flex items-center rounded bg-accent px-3 py-1.5 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover"
          >
            Open team rep tools
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-bold text-zinc-500 transition hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
