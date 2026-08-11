"use client";

import { useToast } from "@/components/Toast";
import type { ShelfSharing } from "@/lib/profile";

// The public/private switch, compact enough to sit in the profile's pill row
// under the section tabs. Drives the same profiles.is_public row as the fuller
// card on the settings page (ShelfSharingToggle), which keeps the shelf link
// and the public preview; this one is just the switch, for collectors who want
// to flip it without leaving their shelf.
export function ShelfVisibilityPill({ sharing }: { sharing: ShelfSharing }) {
  const { shelf, isLoading, isSaving, setPublic } = sharing;
  const { showError } = useToast();

  // Nothing until the row loads: rendering "Private" first and snapping to
  // "Public" would read as the switch flipping itself.
  if (isLoading) return null;

  async function handleToggle() {
    const { error } = await setPublic(!shelf.isPublic);
    if (error) showError(error);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={shelf.isPublic}
      aria-label="Make my shelf public"
      title={
        shelf.isPublic
          ? "Anyone with your link can see your shelf"
          : "Only you can see your shelf"
      }
      disabled={isSaving}
      onClick={handleToggle}
      className="flex items-center gap-2.5 rounded-full border border-black/10 bg-black/[0.04] py-2 pl-4 pr-3 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover disabled:opacity-60"
    >
      {shelf.isPublic ? "Public shelf" : "Private shelf"}
      <span
        aria-hidden
        className={`relative h-5 w-9 flex-shrink-0 rounded-full transition ${
          shelf.isPublic ? "bg-accent" : "bg-black/[0.15]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
            shelf.isPublic ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
