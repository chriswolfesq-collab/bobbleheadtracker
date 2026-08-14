"use client";

import Link from "next/link";
import { useToast } from "@/components/Toast";
import type { FriendVisibility } from "@/lib/profile";

// What an accepted friend sees — the other half of item visibility, separate
// from the public "Show my items" above it (see supabase/friends_visibility.sql).
//
// On by default, unlike the public switch, because it only ever applies to
// someone this member personally accepted. The copy says who that is rather
// than leaving "friends" abstract, since the whole point of the switch is that
// this audience is smaller and chosen.
export function FriendVisibilityToggle({ visibility }: { visibility: FriendVisibility }) {
  const { enabled, isLoading, isSaving, setEnabled } = visibility;
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
            Show my friends more
          </h2>
          <p className="mt-1.5 text-sm text-zinc-600">
            {enabled
              ? "Collectors you've accepted as friends see the bobbleheads you own, your favorites, and your wanted list — whether or not your shelf shows them publicly."
              : "Friends see the same shelf as everyone else. Turn this on and the collectors you've accepted also see the bobbleheads you own, your favorites, and your wanted list."}
          </p>
          <p className="mt-1.5 text-xs text-zinc-500">
            Only people whose{" "}
            <Link href="/profile/friends" className="font-semibold text-accent hover:underline">
              friend requests you accepted
            </Link>
            . Nobody else, and never your condition notes or what you paid.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Show my friends more than the public sees"
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
