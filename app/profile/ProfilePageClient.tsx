"use client";

import { useState } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AwardCelebration } from "@/components/AwardCelebration";
import { CaseBanner } from "@/components/CaseBanner";
import { ProfileSections } from "@/components/ProfileSections";
import { ProfileWelcomeModal } from "@/components/ProfileWelcomeModal";
import { getDisplayName, MAX_DISPLAY_NAME_LENGTH, useAuth } from "@/lib/auth";
import {
  useCollectionSummary,
  useMyAwardFacts,
  useMyFavorites,
  useMyShelf,
  useMySubmissions,
  useMyWanted,
  useSiteBobbleheadCounts,
} from "@/lib/profile";
import { computeShelfStats } from "@/lib/shelfStats";

export function ProfilePageClient() {
  const { user, isLoading: isAuthLoading, updateDisplayName } = useAuth();
  const { countByTeamSlug, totalOwned, isLoading: isCollectionLoading } = useCollectionSummary();
  const { totalByTeamSlug, siteTotal, isLoading: isSiteTotalLoading } = useSiteBobbleheadCounts();
  const { submissions, isLoading: isSubmissionsLoading, error: submissionsError } = useMySubmissions();
  const { favorites, isLoading: isFavoritesLoading, error: favoritesError } = useMyFavorites();
  const { wanted, isLoading: isWantedLoading, error: wantedError } = useMyWanted();
  // Called once here and passed down: both share buttons and the visibility
  // pill under the jump nav need it, and each calling the hook would refetch
  // the same row — and, worse, hold its own copy of isPublic to disagree over.
  // (The fuller sharing card, with the link and the preview, is on /settings.)
  const sharing = useMyShelf();
  const awardFacts = useMyAwardFacts();
  // The same stats the profile body computes, needed a level up so the
  // celebration can see the team ladders too — one shopping trip can clear a
  // count rung and a team rung together.
  const stats = computeShelfStats(countByTeamSlug, totalByTeamSlug);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      {/* Outside the signed-in branch on purpose: the trail is how you get back
          out of the sign-in prompt too. Its column matches the signed-in
          content below. */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "My Shelf" }]} />
      </div>

      {isAuthLoading ? null : !user ? (
        <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 pb-24 text-center">
          <h1 className="text-lg font-black text-zinc-900">Sign in to see your profile</h1>
          <p className="text-sm text-zinc-600">
            Log in to track your collection and see your submissions.
          </p>
        </div>
      ) : (
        // Same column as the teams page: the display case is the centrepiece of
        // this page and it hangs at the teams wall's width, so the rest of the
        // profile lines up with it rather than sitting in a narrower stripe.
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-2 sm:px-6">
          <ProfileWelcomeModal userId={user.id} />

          {/* Only on the owner's own profile: the admin read-only view renders
              ProfileSections directly, so nobody gets congratulated for someone
              else's shelf. */}
          <AwardCelebration
            userId={user.id}
            facts={{
              totalOwned: stats.totalOwned,
              teamsStarted: stats.teamsStarted,
              teamsCompleted: stats.teamsCompleted,
              memberNumber: awardFacts.memberNumber,
              repTeams: awardFacts.repTeams,
            }}
            isLoading={isCollectionLoading || isSiteTotalLoading || awardFacts.isLoading}
          />

          {/* The display case carries the profile header: name inside the lit
              recess, owned count on the card. The name is the edit affordance,
              but the editor itself renders under the artwork — an input and two
              buttons don't fit inside the case's text region. */}
          <CaseBanner
            preload
            overlay={
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-brass lg:text-[11px]">
                  My Profile
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(getDisplayName(user));
                    setIsEditingName(true);
                  }}
                  title="Edit your name"
                  className="mt-1 w-full truncate text-left font-display text-xl font-bold uppercase tracking-wide text-navy transition hover:text-accent-hover lg:text-2xl"
                >
                  {getDisplayName(user)}
                </button>
              </>
            }
            card={
              <div className="w-full rounded-lg border border-border-soft bg-surface/90 px-2 py-2 text-center shadow-sm lg:px-3 lg:py-3">
                <p className="font-display text-base font-bold uppercase tracking-wide tabular-nums text-navy lg:text-xl">
                  {isCollectionLoading || isSiteTotalLoading ? "—" : `${totalOwned}/${siteTotal}`}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-zinc-600 lg:text-xs">
                  Bobbleheads
                  <br />
                  owned
                </p>
              </div>
            }
            mobile={
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brass">
                  My Profile
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(getDisplayName(user));
                    setIsEditingName(true);
                  }}
                  title="Edit your name"
                  className="mt-2 max-w-full truncate font-display text-3xl font-bold uppercase tracking-wide text-navy transition hover:text-accent-hover"
                >
                  {getDisplayName(user)}
                </button>
                <p className="mt-2 text-sm font-semibold text-zinc-600">
                  {isCollectionLoading || isSiteTotalLoading
                    ? "Loading…"
                    : `${totalOwned}/${siteTotal} bobbleheads owned`}
                </p>
              </>
            }
          />

          <header className={isEditingName || nameError ? "mb-8 text-center" : "mb-8"}>
            {isEditingName ? (
              <form
                className="mt-4 flex flex-wrap items-center justify-center gap-2"
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
                  className="w-48 rounded-lg border border-black/10 bg-white px-3 py-2 text-center text-lg font-black text-zinc-900 outline-none focus:border-accent"
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
                  className="rounded border border-black/15 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-700"
                >
                  Cancel
                </button>
              </form>
            ) : null}
            {nameError ? <p className="mt-1 text-xs font-semibold text-red-400">{nameError}</p> : null}
          </header>

          <ProfileSections
            countByTeamSlug={countByTeamSlug}
            totalByTeamSlug={totalByTeamSlug}
            displayName={getDisplayName(user)}
            sharing={sharing}
            isCollectionLoading={isCollectionLoading || isSiteTotalLoading}
            favorites={favorites}
            isFavoritesLoading={isFavoritesLoading}
            favoritesError={favoritesError}
            wanted={wanted}
            isWantedLoading={isWantedLoading}
            wantedError={wantedError}
            submissions={submissions}
            isSubmissionsLoading={isSubmissionsLoading}
            submissionsError={submissionsError}
            awardFacts={awardFacts}
          />
        </div>
      )}
    </div>
  );
}
