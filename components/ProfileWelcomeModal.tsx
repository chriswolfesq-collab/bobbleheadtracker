"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

// One-time intro shown the first time a signed-in member lands on their own
// profile. "Seen" is tracked per user id in localStorage so a fresh account on
// the same device still gets the tour, and so it never nags on later visits.
// It's deliberately not stored server-side: missing the intro (e.g. private
// browsing where localStorage throws) is harmless, so a device-local flag is
// enough and avoids a round-trip on every profile load.
const SEEN_KEY_PREFIX = "bht:profile-welcome-seen:";

const FEATURES: { icon: string; title: string; body: string }[] = [
  {
    icon: "🏆",
    title: "Track your collection",
    body: "Mark the bobbleheads you own across every team and watch your progress fill in.",
  },
  {
    icon: "★",
    title: "Favorites",
    body: "Star the ones you love to keep them a tap away.",
  },
  {
    icon: "♥",
    title: "Wanted list",
    body: "Build a wishlist of the bobbleheads you're still hunting for.",
  },
  {
    icon: "📷",
    title: "Submissions",
    body: "Send in photos and new bobbleheads to help grow the site.",
  },
];

// localStorage is external mutable state, so useSyncExternalStore reads it the
// way React intends: it returns "seen" during SSR and the first client render,
// then re-renders once from the real snapshot — no setState-in-effect, and no
// hydration mismatch warning. The flag never changes for other reasons while
// the page is mounted, so subscribe is a no-op.
const noopSubscribe = () => () => {};

export function ProfileWelcomeModal({ userId }: { userId: string }) {
  const seen = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return window.localStorage.getItem(SEEN_KEY_PREFIX + userId) ? "1" : "";
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
      window.localStorage.setItem(SEEN_KEY_PREFIX + userId, "1");
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
      aria-labelledby="profile-welcome-title"
      onClick={dismiss}
    >
      <div
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1a2b] p-6 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-[#07111d]">
            🏆
          </div>
          <div>
            <h2 id="profile-welcome-title" className="text-lg font-black text-white">
              Welcome to your profile
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Here&apos;s everything you can do from here.
            </p>
          </div>
        </div>

        <ul className="grid gap-3">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm text-amber-300"
              >
                {feature.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-zinc-100">{feature.title}</span>
                <span className="text-xs leading-5 text-zinc-400">{feature.body}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* The privacy choice gets its own highlighted callout — it's the one
            feature that lives on a different page and the one members most need
            to know exists. */}
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-amber-200">
            <span aria-hidden>🔒</span> Public or private?
          </h3>
          <p className="mt-1.5 text-xs leading-5 text-amber-100/80">
            Your profile is private by default. On the{" "}
            <span className="font-bold">Settings</span> page you can make it public to get a
            shareable link — or keep it just for you.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            href="/settings"
            onClick={dismiss}
            className="rounded-lg border border-amber-400 px-3 py-2.5 text-center text-xs font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400/10"
          >
            Open settings
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg bg-amber-500 px-3 py-2.5 text-xs font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
