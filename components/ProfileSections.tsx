"use client";

import Image from "next/image";
import Link from "next/link";
import { publicAsset } from "@/lib/paths";
import { type MyFavorite, type MySubmission, type MyWanted } from "@/lib/profile";
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
  favorites,
  isFavoritesLoading,
  wanted,
  isWantedLoading,
  submissions,
  isSubmissionsLoading,
}: {
  countByTeamSlug: Record<string, number>;
  totalByTeamSlug: Record<string, number>;
  favorites: MyFavorite[];
  isFavoritesLoading: boolean;
  wanted: MyWanted[];
  isWantedLoading: boolean;
  submissions: MySubmission[];
  isSubmissionsLoading: boolean;
}) {
  const teamCounts = TEAMS.map((team) => ({
    team,
    count: countByTeamSlug[team.slug] ?? 0,
  })).sort((a, b) => b.count - a.count || a.team.name.localeCompare(b.team.name));

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
