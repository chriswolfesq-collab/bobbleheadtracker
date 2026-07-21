"use client";

import { useToast } from "@/components/Toast";
import type { GallerySharing } from "@/lib/profile";

// The opt-in to show your actual owned bobbleheads and favorites on your public
// shelf, not just the counts (see supabase/gallery.sql). Same shape as
// ShelfSharingToggle / EmailAlertsToggle: the switch flipping is the success
// feedback, and the toast is error-only.
//
// Only meaningful once the shelf is public, so SettingsPageClient renders this
// beneath ShelfSharingToggle and only when sharing is on — there's no public
// page for a gallery to appear on otherwise.
export function GalleryToggle({ gallery }: { gallery: GallerySharing }) {
  const { enabled, isLoading, isSaving, setEnabled } = gallery;
  const { showError } = useToast();

  async function handleToggle() {
    const { error } = await setEnabled(!enabled);
    if (error) showError(error);
  }

  if (isLoading) return null;

  return (
    <div className="mb-8 rounded-2xl border border-black/10 bg-black/[0.04] p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600 dark:text-zinc-400">
            Show my items
          </h2>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {enabled
              ? "Your public shelf shows the bobbleheads you own and your favorites, not just the counts."
              : "Turn this on to show the actual bobbleheads you own and your favorites on your public shelf, not just the counts."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Show my items on my public shelf"
          disabled={isSaving}
          onClick={handleToggle}
          className={`relative h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-60 ${
            enabled ? "bg-accent" : "bg-black/[0.08] dark:bg-white/15"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              enabled ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
