"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import { publicAsset } from "@/lib/paths";

// One-time intro shown the first time anyone lands on the site. Unlike the
// profile intro this isn't tied to an account — a visitor may be anonymous —
// so "seen" is a single device-level flag rather than one keyed per user.
// Same rationale for keeping it in localStorage: missing it is harmless, so a
// device-local flag beats any server round-trip on the busiest page.
const SEEN_KEY = "bht:home-welcome-seen";

const FEATURES: { icon: string; title: string; body: string }[] = [
  {
    icon: "⚾",
    title: "Every team, every bobblehead",
    body: "Browse SGA stadium giveaway bobbleheads across all 30 MLB teams — click a team on the shelf to dig in.",
  },
  {
    icon: "🔍",
    title: "Search",
    body: "Jump straight to any player or bobblehead with the search bar up top.",
  },
  {
    icon: "🏆",
    title: "Track what you own",
    body: "Create a free account to mark your collection, heart favorites, and build a wanted list.",
  },
  {
    icon: "🎉",
    title: "Show it off",
    body: "Make your shelf public and share a link to your whole collection.",
  },
];

// Reads the device-level flag through useSyncExternalStore so there's no
// setState-in-effect and no hydration mismatch — see ProfileWelcomeModal for
// the full rationale. The flag never changes while the page is mounted.
const noopSubscribe = () => () => {};

export function HomeWelcomeModal() {
  const { user, openAuthModal } = useAuth();
  const seen = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return window.localStorage.getItem(SEEN_KEY) ? "1" : "";
      } catch {
        // localStorage unavailable (private mode / disabled) — skip the intro.
        return "1";
      }
    },
    () => "1",
  );
  const [dismissed, setDismissed] = useState(false);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Nothing to persist to — the modal is already closed for this session.
    }
  }

  if (seen || dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-welcome-title"
      onClick={dismiss}
    >
      <div
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-2xl shadow-black/50 dark:border-white/10 dark:bg-[#0b1a2b]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          {/* A trio of full bobblehead figures from different teams stands in
              for a logo at the top of the intro — a nod to "every team." Same
              677×1607 shelf art, shown whole. */}
          <div className="flex items-end justify-center gap-7">
            {["dodgers", "orioles", "angels"].map((team) => (
              <Image
                key={team}
                src={publicAsset(`/bobbleheads/${team}.png`)}
                alt=""
                width={677}
                height={1607}
                sizes="90px"
                className="h-24 w-auto drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"
              />
            ))}
          </div>
          <div>
            <h2 id="home-welcome-title" className="text-lg font-black text-zinc-900 dark:text-white">
              Welcome to Bobble Shelf
            </h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              The home for every MLB stadium giveaway bobblehead.
            </p>
          </div>
        </div>

        <ul className="grid gap-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-black/10 bg-black/[0.04] text-sm text-accent dark:border-white/10 dark:bg-white/5"
              >
                {feature.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{feature.title}</span>
                <span className="text-xs leading-5 text-zinc-600 dark:text-zinc-400">{feature.body}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* Signed-in visitors (rare on a true first visit, but possible) don't
            need the sign-up nudge, so the primary action collapses to a single
            "Start exploring" button for them. */}
        {user ? (
          <button
            type="button"
            onClick={dismiss}
            className="mt-5 w-full rounded-lg bg-accent px-3 py-2.5 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover"
          >
            Start exploring
          </button>
        ) : (
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => {
                dismiss();
                openAuthModal("sign-up");
              }}
              className="rounded-lg bg-accent px-3 py-2.5 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover"
            >
              Create a free account
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-center text-xs font-bold uppercase tracking-wide text-zinc-500 transition hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Continue without an account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
