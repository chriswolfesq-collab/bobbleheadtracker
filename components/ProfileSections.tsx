"use client";

import Image from "next/image";
import Link from "next/link";
import DisplayCase from "@/components/DisplayCase";
import { ShareCollectionButton } from "@/components/ShareCollectionButton";
import { publicAsset } from "@/lib/paths";
import {
  type MyFavorite,
  type MySubmission,
  type MyWanted,
  type ShelfSharing,
} from "@/lib/profile";
import { computeShelfStats } from "@/lib/shelfStats";
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

// The Collection / Favorites / Submissions body shared by the user's own
// profile page (app/profile) and the admin read-only "view profile" page
// (app/admin/users/view). All data is passed in as props so the same markup
// can be driven either by the signed-in user's session or, in admin mode, by
// the parameterized profile hooks pointed at another user via the admin client.
export function ProfileSections({
  countByTeamSlug,
  totalByTeamSlug,
  displayName,
  sharing,
  isCollectionLoading = false,
  favorites,
  isFavoritesLoading,
  wanted,
  isWantedLoading,
  submissions,
  isSubmissionsLoading,
}: {
  countByTeamSlug: Record<string, number>;
  totalByTeamSlug: Record<string, number>;
  /** Whose collection this is. Omitted in the admin read-only view, which hides
   *  the share button rather than let an admin share another user's shelf. */
  displayName?: string;
  /** Omitted alongside displayName in the admin view, for the same reason. */
  sharing?: ShelfSharing;
  /** Counts still loading. Without it the share button is live over an empty
   *  collection and captures a 0/0 shelf. */
  isCollectionLoading?: boolean;
  favorites: MyFavorite[];
  isFavoritesLoading: boolean;
  wanted: MyWanted[];
  isWantedLoading: boolean;
  submissions: MySubmission[];
  isSubmissionsLoading: boolean;
}) {
  // Shared with the public /shelf/<slug> page so a collector's own profile and
  // the link they hand out always agree on the numbers.
  const stats = computeShelfStats(countByTeamSlug, totalByTeamSlug);
  const { totalOwned, siteTotal, pctComplete, teamsStarted, slotsEmpty } = stats;

  return (
    <>
      <nav className="mb-8 flex flex-wrap justify-center gap-2">
        {[
          { id: "collection", label: "Collection" },
          { id: "favorites", label: "Favorites" },
          { id: "wanted", label: "Wanted" },
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
        {/* The button overlays the shelf rather than living inside DisplayCase:
            DisplayCase is also what the share card itself renders, so a button in
            there would recurse and end up baked into the shared image. */}
        <div className="relative mx-auto w-full max-w-2xl">
          <DisplayCase countByTeamSlug={countByTeamSlug} totalByTeamSlug={totalByTeamSlug} />
          {displayName && sharing ? (
            <div className="absolute right-4 top-0 z-30 text-right sm:right-6">
              <ShareCollectionButton
                variant="overlay"
                displayName={displayName}
                countByTeamSlug={countByTeamSlug}
                totalByTeamSlug={totalByTeamSlug}
                stats={stats}
                sharing={sharing}
                isLoading={isCollectionLoading}
              />
            </div>
          ) : null}
        </div>

        <div className="mb-4 mt-6 flex items-center justify-between gap-3">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">
            Collection progress
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs font-black tabular-nums text-amber-300">
              {totalOwned}/{siteTotal}
            </span>
            {displayName && sharing ? (
              <ShareCollectionButton
                displayName={displayName}
                countByTeamSlug={countByTeamSlug}
                totalByTeamSlug={totalByTeamSlug}
                stats={stats}
                sharing={sharing}
                isLoading={isCollectionLoading}
              />
            ) : null}
          </div>
        </div>

        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${pctComplete}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs font-bold text-zinc-500">
            {pctComplete}% complete · {teamsStarted}/{TEAMS.length} teams started ·{" "}
            {slotsEmpty} slots empty
          </p>
        </div>
      </section>

      <section id="favorites" className="mb-10 scroll-mt-6">
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-400">
          Favorites
        </h2>
        {isFavoritesLoading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : favorites.length === 0 ? (
          <p className="text-sm text-zinc-400">No favorites yet.</p>
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

      <section id="wanted" className="mb-10 scroll-mt-6">
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-400">
          Wanted
        </h2>
        {isWantedLoading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : wanted.length === 0 ? (
          <p className="text-sm text-zinc-400">Nothing on your wanted list yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {wanted.map((item, index) => {
              const team = TEAMS.find((t) => t.slug === item.teamSlug);
              const imageSrc = item.imageUrl ?? publicAsset(`/bobbleheads/${item.teamSlug}.png`);

              return (
                <Link
                  key={`${item.teamSlug}:${item.bobbleheadId}`}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/5 ${
                    index !== wanted.length - 1 ? "border-b border-white/10" : ""
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
                    <span className="block truncate font-bold text-zinc-100">{item.title}</span>
                    <span className="text-xs text-zinc-500">{team?.name ?? item.teamSlug}</span>
                  </span>
                  <span aria-hidden className="ml-auto flex-shrink-0 text-lg text-amber-400">
                    ★
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section id="submissions" className="scroll-mt-6">
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-400">
          Submissions
        </h2>
        {isSubmissionsLoading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-zinc-400">Nothing submitted yet.</p>
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
    </>
  );
}
