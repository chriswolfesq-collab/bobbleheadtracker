"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { copyText } from "@/lib/clipboard";
import type { ShelfSharing } from "@/lib/profile";

// The opt-in for a public /shelf/<slug> page. Lives on the profile page rather
// than inside ProfileSections because ProfileSections is also rendered by the
// admin "view profile" page, and useMyShelf always reads the signed-in account
// — an admin looking at someone else's profile would otherwise be shown a
// toggle for their own shelf.
export function ShelfSharingToggle({ sharing }: { sharing: ShelfSharing }) {
  const { shelf, isLoading, isSaving, setPublic } = sharing;
  const { showError } = useToast();
  const [didCopy, setDidCopy] = useState(false);

  useEffect(() => {
    if (!didCopy) return;

    const timer = setTimeout(() => setDidCopy(false), 2000);
    return () => clearTimeout(timer);
  }, [didCopy]);

  // Read at render rather than stashed in state from an effect: the component
  // renders null until the settings load, so this only ever runs in the
  // browser and can't produce a server/client mismatch. Taken from the live
  // origin rather than a hardcoded domain so the link is correct on Vercel
  // preview deployments too.
  const shelfUrl =
    shelf.slug && typeof window !== "undefined"
      ? `${window.location.origin}/shelf/${shelf.slug}`
      : null;

  async function handleToggle() {
    // The switch flipping and the URL appearing are the success feedback here;
    // the toast is error-only (see components/Toast.tsx), so a "your shelf is
    // public" toast would render in red as an alert.
    const { error } = await setPublic(!shelf.isPublic);
    if (error) showError(error);
  }

  async function handleCopy() {
    if (!shelfUrl) return;

    if (await copyText(shelfUrl)) {
      setDidCopy(true);
      return;
    }
    showError("Couldn't copy. Select the link and copy it manually.");
  }

  if (isLoading) return null;

  return (
    <div className="mb-8 rounded-2xl border border-black/10 bg-black/[0.04] p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600 dark:text-zinc-400">
            Public shelf
          </h2>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {shelf.isPublic
              ? "Anyone with your link can see your shelf and your team counts."
              : "Turn this on to get a link you can post. Your shelf is private until you do."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={shelf.isPublic}
          aria-label="Make my shelf public"
          disabled={isSaving}
          onClick={handleToggle}
          className={`relative h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-60 ${
            shelf.isPublic ? "bg-accent" : "bg-black/[0.08] dark:bg-white/15"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              shelf.isPublic ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {shelf.isPublic && shelfUrl ? (
        <div className="mt-4 flex items-center gap-2">
          <code className="min-w-0 flex-1 select-all truncate rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-accent dark:border-white/10 dark:bg-[#07111d] dark:text-accent">
            {shelfUrl}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="w-20 flex-shrink-0 rounded-lg border border-black/10 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover dark:border-white/15 dark:text-zinc-300 dark:hover:text-accent-hover"
          >
            {didCopy ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
