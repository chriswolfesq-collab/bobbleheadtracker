"use client";

import { useToast } from "@/components/Toast";
import type { WantedSharing } from "@/lib/profile";

// The opt-in to show your wanted list on your public shelf (see
// supabase/public_wanted_list.sql). Same shape as GalleryToggle — the switch
// flipping is the success feedback, and the toast is error-only.
//
// Sits right under "Show my items" because the two decide what one link shows.
// The copy leans on the reason collectors asked for this: the person most
// likely to open your shelf link isn't another collector, it's someone standing
// in front of a bobblehead wondering whether you already have it.
export function WantedListToggle({ wanted }: { wanted: WantedSharing }) {
  const { enabled, isLoading, isSaving, setEnabled } = wanted;
  const { showError } = useToast();

  async function handleToggle() {
    const { error } = await setEnabled(!enabled);
    if (error) showError(error);
  }

  if (isLoading) return null;

  return (
    <div className="mb-8 rounded-2xl border border-black/10 bg-black/[0.04] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
            Show my wanted list
          </h2>
          <p className="mt-1.5 text-sm text-zinc-600">
            {enabled
              ? "Your public shelf shows what you're still hunting for, so anyone with your link can check before they buy."
              : "Turn this on to show what you're still hunting for on your public shelf — handy when someone spots a bobblehead and isn't sure whether you want it."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Show my wanted list on my public shelf"
          disabled={isSaving}
          onClick={handleToggle}
          className={`relative h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-60 ${
            enabled ? "bg-accent" : "bg-black/[0.08]"
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
