"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthWidget } from "@/components/AuthWidget";
import { ProfileSections } from "@/components/ProfileSections";
import { ProfileWelcomeModal } from "@/components/ProfileWelcomeModal";
import { getDisplayName, MAX_DISPLAY_NAME_LENGTH, useAuth } from "@/lib/auth";
import {
  useCollectionSummary,
  useMyFavorites,
  useMyShelf,
  useMySubmissions,
  useMyWanted,
  useSiteBobbleheadCounts,
} from "@/lib/profile";

export function ProfilePageClient() {
  const { user, isLoading: isAuthLoading, updateDisplayName } = useAuth();
  const { countByTeamSlug, totalOwned, isLoading: isCollectionLoading } = useCollectionSummary();
  const { totalByTeamSlug, siteTotal, isLoading: isSiteTotalLoading } = useSiteBobbleheadCounts();
  const { submissions, isLoading: isSubmissionsLoading } = useMySubmissions();
  const { favorites, isLoading: isFavoritesLoading } = useMyFavorites();
  const { wanted, isLoading: isWantedLoading } = useMyWanted();
  // Called once here and passed down: both share buttons need it, and each
  // calling the hook would refetch the same row. (The public-shelf privacy
  // toggle now lives on the settings page.)
  const sharing = useMyShelf();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      <div className="flex items-center justify-between px-4 pt-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 transition hover:text-accent-hover dark:text-zinc-300 dark:hover:text-accent-hover"
        >
          <span aria-hidden>←</span> Back to home
        </Link>
        <AuthWidget hideProfileLink />
      </div>

      {isAuthLoading ? null : !user ? (
        <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 pb-24 text-center">
          <h1 className="text-lg font-black text-zinc-900 dark:text-white">Sign in to see your profile</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Log in to track your collection and see your submissions.
          </p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-2 sm:px-6">
          <ProfileWelcomeModal userId={user.id} />
          <header className="mb-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent/80 sm:text-xs">
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
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  className="w-48 rounded-lg border border-black/10 bg-white px-3 py-2 text-center text-lg font-black text-zinc-900 outline-none focus:border-accent dark:border-white/15 dark:bg-[#07111d] dark:text-white"
                />
                <button
                  type="submit"
                  disabled={isSavingName}
                  className="rounded border border-accent px-3 py-2 text-xs font-black uppercase tracking-wide text-accent disabled:opacity-60"
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
                  className="rounded border border-black/15 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-700 dark:border-white/20 dark:text-zinc-300"
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
                className="mt-2 text-2xl font-black text-zinc-900 transition hover:text-accent-hover dark:text-white dark:hover:text-accent-hover"
                title="Edit your name"
              >
                {getDisplayName(user)}
              </button>
            )}
            {nameError ? <p className="mt-1 text-xs font-semibold text-red-400">{nameError}</p> : null}
            <p className="mt-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              {isCollectionLoading || isSiteTotalLoading
                ? "Loading…"
                : `${totalOwned}/${siteTotal} bobbleheads owned`}
            </p>
          </header>

          <ProfileSections
            countByTeamSlug={countByTeamSlug}
            totalByTeamSlug={totalByTeamSlug}
            displayName={getDisplayName(user)}
            sharing={sharing}
            isCollectionLoading={isCollectionLoading || isSiteTotalLoading}
            favorites={favorites}
            isFavoritesLoading={isFavoritesLoading}
            wanted={wanted}
            isWantedLoading={isWantedLoading}
            submissions={submissions}
            isSubmissionsLoading={isSubmissionsLoading}
          />
        </div>
      )}
    </div>
  );
}
