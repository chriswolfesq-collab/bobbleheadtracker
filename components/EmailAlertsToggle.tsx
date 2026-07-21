"use client";

import { useToast } from "@/components/Toast";
import type { EmailAlerts } from "@/lib/profile";

// The opt-out for wanted-list "new owner" emails (see supabase/wishlist_alerts.sql;
// the DB column/RPC keep the "wishlist" name). Same shape as ShelfSharingToggle:
// the switch flipping is the success feedback, and the toast is error-only.
export function EmailAlertsToggle({ alerts }: { alerts: EmailAlerts }) {
  const { enabled, isLoading, isSaving, setEnabled } = alerts;
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
            Wanted alerts
          </h2>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {enabled
              ? "We'll email you when a bobblehead on your wanted list is marked owned by another collector."
              : "Turn this on to get an email when a bobblehead on your wanted list gets a new owner."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Email me wanted alerts"
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
