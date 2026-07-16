"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthWidget } from "@/components/AuthWidget";
import { ProfileSections } from "@/components/ProfileSections";
import { getDisplayName, useAuth } from "@/lib/auth";
import {
  useCollectionSummary,
  useMyFavorites,
  useMySubmissions,
  useSiteBobbleheadCounts,
} from "@/lib/profile";

export function ProfilePageClient() {
  const { user, isLoading: isAuthLoading, updateDisplayName } = useAuth();
  const { countByTeamSlug, totalOwned, isLoading: isCollectionLoading } = useCollectionSummary();
  const { totalByTeamSlug, siteTotal, isLoading: isSiteTotalLoading } = useSiteBobbleheadCounts();
  const { submissions, isLoading: isSubmissionsLoading } = useMySubmissions();
  const { favorites, isLoading: isFavoritesLoading } = useMyFavorites();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, #1b2a4a 0%, #0e1626 45%, #090e1a 100%)",
      }}
    >
      <div className="flex items-center justify-between px-4 pt-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-300 transition hover:text-amber-300"
        >
          <span aria-hidden>←</span> Back to home
        </Link>
        <AuthWidget hideProfileLink />
      </div>

      {isAuthLoading ? null : !user ? (
        <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 pb-24 text-center">
          <h1 className="text-lg font-black text-white">Sign in to see your profile</h1>
          <p className="text-sm text-zinc-400">
            Log in to track your collection and see your submissions.
          </p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-2 sm:px-6">
          <header className="mb-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-500/80 sm:text-xs">
              My Profile
            </p>
            {isEditingName ? (
              <form
                className="mt-2 flex items-center justify-center gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setNameError(null);
                  setIsSavingName(true);
                  const result = await updateDisplayName(nameDraft.trim());
                  setIsSavingName(false);
                  if (result.error) {
                    setNameError(result.error);
                    return;
                  }
                  setIsEditingName(false);
                }}
              >
                <input
                  autoFocus
                  required
                  type="text"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  className="w-48 rounded-lg border border-white/15 bg-[#07111d] px-3 py-2 text-center text-lg font-black text-white outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={isSavingName}
                  className="rounded border border-amber-400 px-3 py-2 text-xs font-black uppercase tracking-wide text-amber-300 disabled:opacity-60"
                >
                  {isSavingName ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(false);
                    setNameDraft(getDisplayName(user));
                    setNameError(null);
                  }}
                  className="rounded border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-300"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNameDraft(getDisplayName(user));
                  setIsEditingName(true);
                }}
                className="mt-2 text-2xl font-black text-white transition hover:text-amber-300"
                title="Edit your name"
              >
                {getDisplayName(user)}
              </button>
            )}
            {nameError ? <p className="mt-1 text-xs font-semibold text-red-400">{nameError}</p> : null}
            <p className="mt-3 text-sm font-semibold text-zinc-400">
              {isCollectionLoading || isSiteTotalLoading
                ? "Loading…"
                : `${totalOwned}/${siteTotal} bobbleheads owned`}
            </p>
          </header>

          <ProfileSections
            countByTeamSlug={countByTeamSlug}
            totalByTeamSlug={totalByTeamSlug}
            favorites={favorites}
            isFavoritesLoading={isFavoritesLoading}
            submissions={submissions}
            isSubmissionsLoading={isSubmissionsLoading}
          />
        </div>
      )}
    </div>
  );
}
