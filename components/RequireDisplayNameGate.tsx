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
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b1a2b] p-6 shadow-2xl shadow-black/50">
            <h2 className="text-lg font-black text-white">Choose a username</h2>
            <p className="mt-1 text-xs text-zinc-400">
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
                className="w-full rounded-lg border border-white/15 bg-[#07111d] px-3 py-2.5 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
              />
              {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300 disabled:opacity-60"
              >
                {isSubmitting ? "Saving…" : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="text-center text-xs font-bold uppercase tracking-wide text-zinc-500 hover:text-zinc-300"
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
