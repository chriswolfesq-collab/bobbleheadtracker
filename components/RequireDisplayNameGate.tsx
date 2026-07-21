"use client";

import { useState } from "react";
import { hasDisplayName, MAX_DISPLAY_NAME_LENGTH, useAuth } from "@/lib/auth";

// Blocks the whole app behind a "choose a username" prompt whenever a signed-in
// user has no display_name yet. Email/password sign-up already collects one
// (see AuthWidget), so in practice this only fires right after a first-time
// Google/GitHub sign-in, which skips that form entirely.
export function RequireDisplayNameGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, updateDisplayName, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsDisplayName = !isLoading && Boolean(user) && !hasDisplayName(user);

  return (
    <>
      {children}
      {needsDisplayName ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-2xl shadow-black/50 dark:border-white/10 dark:bg-[#0b1a2b]">
            <h2 className="text-lg font-black text-zinc-900 dark:text-white">Choose a username</h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Pick a username to finish setting up your account.
            </p>
            <form
              className="mt-4 grid gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const trimmed = displayName.trim();
                if (!trimmed) return;

                setError(null);
                setIsSubmitting(true);
                const result = await updateDisplayName(trimmed);
                setIsSubmitting(false);

                if (result.error) {
                  setError(result.error);
                }
              }}
            >
              <input
                autoFocus
                required
                type="text"
                maxLength={MAX_DISPLAY_NAME_LENGTH}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Enter a username"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent dark:border-white/15 dark:bg-[#07111d] dark:text-white"
              />
              {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-accent px-3 py-2.5 text-sm font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
              >
                {isSubmitting ? "Saving…" : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="text-center text-xs font-bold uppercase tracking-wide text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Cancel and log out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
