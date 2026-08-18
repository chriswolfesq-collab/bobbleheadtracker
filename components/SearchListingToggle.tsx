"use client";

import Link from "next/link";
import { useToast } from "@/components/Toast";
import type { SearchListing } from "@/lib/profile";

// Whether other collectors can find this member by name — see
// supabase/member_search_opt_out.sql.
//
// On by default, because search shipped listing everyone; turning it off is the
// choice. The copy has one job beyond the switch itself: not to be read as a
// private shelf. Shelves are public and there is no toggle for that any more, so
// this says what it actually does — no name browsing — and says what still
// works, rather than letting a member assume they've gone dark.
export function SearchListingToggle({ listing }: { listing: SearchListing }) {
  const { enabled, isLoading, isSaving, setEnabled } = listing;
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
            Let collectors find me
          </h2>
          <p className="mt-1.5 text-sm text-zinc-600">
            {enabled
              ? "Signed-in collectors can find you by name and send a friend request. They see your name, your picture and your shelf link — the same things your shelf shows anyone."
              : "You won't turn up when collectors search by name. Anyone who already has your shelf link can still open it and add you, and your friends are unaffected."}
          </p>
          <p className="mt-1.5 text-xs text-zinc-500">
            {enabled
              ? "Never your email — that's not searchable by anyone."
              : "This hides you from search, not from the web: your shelf stays at its link, the way it does for everyone."}{" "}
            <Link href="/profile/friends" className="font-semibold text-accent hover:underline">
              {enabled ? "Try it yourself" : "Your friends"}
            </Link>
            .
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Let collectors find me in member search"
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
