"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthWidget } from "@/components/AuthWidget";
import { getDisplayName, useAuth } from "@/lib/auth";
import { publicAsset } from "@/lib/paths";
import {
  useCollectionSummary,
  useMyFavorites,
  useMySubmissions,
  useSiteBobbleheadCounts,
  type MySubmission,
} from "@/lib/profile";
import { TEAMS } from "@/lib/teams";

const STATUS_STYLES: Record<MySubmission["status"], string> = {
  pending: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  approved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  rejected: "border-red-400/40 bg-red-400/10 text-red-300",
};

function submissionLabel(submission: MySubmission): string {
  if (submission.kind === "new_bobblehead") {
    return submission.title ?? "New bobblehead";
  }
  return "Photo for existing bobblehead";
}

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
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    setNameDraft(getDisplayName(user));
  }, [user]);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const teamCounts = TEAMS.map((team) => ({
    team,
    count: countByTeamSlug[team.slug] ?? 0,
  })).sort((a, b) => b.count - a.count || a.team.name.localeCompare(b.team.name));

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
                onClick={() => setIsEditingName(true)}
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

          <nav className="mb-8 flex flex-wrap justify-center gap-2">
            {[
              { id: "collection", label: "Collection" },
              { id: "favorites", label: "Favorites" },
              { id: "submissions", label: "Submissions" },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-300 transition hover:border-amber-400 hover:text-amber-300"
              >
                {label}
              </button>
            ))}
          </nav>

          <section id="collection" className="mb-10 scroll-mt-6">
            <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-400">
              Collection by team
            </h2>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {teamCounts.map(({ team, count }, index) => (
                <Link
                  key={team.slug}
                  href={`/teams/${team.slug}`}
                  className={`flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-white/5 ${
                    index !== teamCounts.length - 1 ? "border-b border-white/10" : ""
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Image
                      src={publicAsset(`/bobbleheads/${team.slug}.png`)}
                      alt=""
                      width={677}
                      height={1607}
                      sizes="100px"
                      className="h-14 w-auto flex-shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)] sm:h-24"
                    />
                    <span className="font-bold text-zinc-100">{team.name}</span>
                    <span className="text-xs text-zinc-500">{team.city}</span>
                  </span>
                  <span className="font-black tabular-nums text-amber-300">
                    {count}/{totalByTeamSlug[team.slug] ?? 0}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section id="favorites" className="mb-10 scroll-mt-6">
            <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-400">
              My favorites
            </h2>
            {isFavoritesLoading ? (
              <p className="text-sm text-zinc-400">Loading…</p>
            ) : favorites.length === 0 ? (
              <p className="text-sm text-zinc-400">
                Tap the heart on a bobblehead to add it to your favorites.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {favorites.map((favorite, index) => {
                  const team = TEAMS.find((t) => t.slug === favorite.teamSlug);
                  const imageSrc = favorite.imageUrl ?? publicAsset(`/bobbleheads/${favorite.teamSlug}.png`);

                  return (
                    <Link
                      key={`${favorite.teamSlug}:${favorite.bobbleheadId}`}
                      href={favorite.href}
                      className={`flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/5 ${
                        index !== favorites.length - 1 ? "border-b border-white/10" : ""
                      }`}
                    >
                      <Image
                        src={imageSrc}
                        alt=""
                        width={677}
                        height={1607}
                        sizes="120px"
                        className="h-20 w-auto flex-shrink-0 rounded object-cover drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)] sm:h-24"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-zinc-100">{favorite.title}</span>
                        <span className="text-xs text-zinc-500">{team?.name ?? favorite.teamSlug}</span>
                      </span>
                      <span aria-hidden className="ml-auto flex-shrink-0 text-lg text-red-400">
                        ♥
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section id="submissions" className="scroll-mt-6">
            <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-400">
              My submissions
            </h2>
            {isSubmissionsLoading ? (
              <p className="text-sm text-zinc-400">Loading…</p>
            ) : submissions.length === 0 ? (
              <p className="text-sm text-zinc-400">You haven&apos;t submitted anything yet.</p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {submissions.map((submission, index) => {
                  const team = TEAMS.find((t) => t.slug === submission.teamSlug);
                  const imageSrc =
                    submission.imageUrl ?? publicAsset(`/bobbleheads/${submission.teamSlug}.png`);
                  const rowClassName = `flex items-center justify-between gap-3 px-4 py-3 text-sm ${
                    index !== submissions.length - 1 ? "border-b border-white/10" : ""
                  } ${submission.href ? "transition hover:bg-white/5" : ""}`;
                  const content = (
                    <>
                      <span className="flex min-w-0 items-center gap-3">
                        <Image
                          src={imageSrc}
                          alt=""
                          width={677}
                          height={1607}
                          sizes="120px"
                          className="h-20 w-auto flex-shrink-0 rounded object-cover drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)] sm:h-24"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-zinc-100">
                            {submissionLabel(submission)}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {team?.name ?? submission.teamSlug} ·{" "}
                            {new Date(submission.createdAt).toLocaleDateString()}
                          </span>
                        </span>
                      </span>
                      <span
                        className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${STATUS_STYLES[submission.status]}`}
                      >
                        {submission.status}
                      </span>
                    </>
                  );

                  return submission.href ? (
                    <Link key={submission.id} href={submission.href} className={rowClassName}>
                      {content}
                    </Link>
                  ) : (
                    <div key={submission.id} className={rowClassName}>
                      {content}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      <button
        type="button"
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-6 right-4 z-30 grid h-11 w-11 place-items-center rounded-full border border-amber-400/60 bg-[#101827] text-lg font-black text-amber-300 shadow-xl transition hover:bg-[#17233a] sm:right-6 ${
          showBackToTop ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <span aria-hidden>↑</span>
      </button>
    </div>
  );
}
