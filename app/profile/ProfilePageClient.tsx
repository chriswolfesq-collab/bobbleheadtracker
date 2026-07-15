"use client";

import Link from "next/link";
import { AuthWidget } from "@/components/AuthWidget";
import { useAuth } from "@/lib/auth";
import { useCollectionSummary, useMySubmissions, type MySubmission } from "@/lib/profile";
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
  const { user, isLoading: isAuthLoading } = useAuth();
  const { countByTeamSlug, totalOwned, isLoading: isCollectionLoading } = useCollectionSummary();
  const { submissions, isLoading: isSubmissionsLoading } = useMySubmissions();

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
      <div className="flex justify-end px-4 pt-4 sm:px-6">
        <AuthWidget />
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
            <h1 className="mt-2 text-2xl font-black text-white">{user.email}</h1>
            <p className="mt-3 text-sm font-semibold text-zinc-400">
              {isCollectionLoading ? "Loading…" : `${totalOwned} bobbleheads owned`}
            </p>
          </header>

          <section className="mb-10">
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
                  <span className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: team.primary }}
                    />
                    <span className="font-bold text-zinc-100">{team.name}</span>
                    <span className="text-xs text-zinc-500">{team.city}</span>
                  </span>
                  <span className="font-black tabular-nums text-amber-300">{count}</span>
                </Link>
              ))}
            </div>
          </section>

          <section>
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
                  return (
                    <div
                      key={submission.id}
                      className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${
                        index !== submissions.length - 1 ? "border-b border-white/10" : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-zinc-100">
                          {submissionLabel(submission)}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {team?.name ?? submission.teamSlug} ·{" "}
                          {new Date(submission.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                      <span
                        className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${STATUS_STYLES[submission.status]}`}
                      >
                        {submission.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
