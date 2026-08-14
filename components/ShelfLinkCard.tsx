"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { copyText } from "@/lib/clipboard";
import type { ShelfSharing } from "@/lib/profile";

// The link to the always-public /shelf/<slug> page. Lives on the settings page
// rather than inside ProfileSections because ProfileSections is also rendered
// by the admin "view profile" page, and useMyShelf always reads the signed-in
// account — an admin looking at someone else's profile would otherwise be
// shown their own shelf link.
export function ShelfLinkCard({ sharing }: { sharing: ShelfSharing }) {
  const { shelf, isLoading } = sharing;
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
    <div className="mb-8 rounded-2xl border border-black/10 bg-black/[0.04] p-4">
      <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
        Your shelf link
      </h2>
      <p className="mt-1.5 text-sm text-zinc-600">
        Anyone with your link can see your shelf and your team counts.
      </p>

      {shelfUrl ? (
        <div className="mt-4 flex items-center gap-2">
          <code className="min-w-0 flex-1 select-all truncate rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-accent">
            {shelfUrl}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="w-20 flex-shrink-0 rounded-lg border border-black/10 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover"
          >
            {didCopy ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}

      {/* Opens in a new tab so their place in settings is kept. */}
      <Link
        href="/settings/preview"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-black/10 px-3 py-2.5 text-[11px] font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover"
      >
        <span aria-hidden>👁</span>
        Preview what the public sees
      </Link>
    </div>
  );
}
