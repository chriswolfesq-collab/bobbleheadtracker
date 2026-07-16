"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuthWidget } from "@/components/AuthWidget";
import { RecentlyAddedCard } from "@/components/RecentlyAddedCard";
import { useRecentCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { getTeamBySlug } from "@/lib/teams";

const RECENT_LIMIT = 200;
const UNKNOWN_YEAR = "Unknown";
const FIELD_CLASSES =
  "mt-1 w-full rounded border border-white/15 bg-[#07111d] px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400";

function extractYear(date: string): string {
  const match = date.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : UNKNOWN_YEAR;
}

export function RecentlyAddedPageClient() {
  const { communityBobbleheads, isLoading } = useRecentCommunityBobbleheads(RECENT_LIMIT);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const teamOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const bobblehead of communityBobbleheads) {
      if (seen.has(bobblehead.teamSlug)) continue;
      const team = getTeamBySlug(bobblehead.teamSlug);
      seen.set(bobblehead.teamSlug, team ? `${team.city} ${team.name}` : bobblehead.teamSlug);
    }
    return Array.from(seen, ([slug, label]) => ({ slug, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [communityBobbleheads]);

  const yearOptions = useMemo(() => {
    const years = new Set(communityBobbleheads.map((bobblehead) => extractYear(bobblehead.date)));
    return Array.from(years).sort((a, b) => {
      if (a === UNKNOWN_YEAR) return 1;
      if (b === UNKNOWN_YEAR) return -1;
      return b.localeCompare(a);
    });
  }, [communityBobbleheads]);

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return communityBobbleheads.filter((bobblehead) => {
      if (teamFilter && bobblehead.teamSlug !== teamFilter) return false;
      if (yearFilter && extractYear(bobblehead.date) !== yearFilter) return false;

      if (terms.length > 0) {
        const team = getTeamBySlug(bobblehead.teamSlug);
        const haystack = `${bobblehead.title} ${bobblehead.date} ${team?.name ?? ""} ${team?.city ?? ""} ${bobblehead.teamSlug}`.toLowerCase();
        if (!terms.every((term) => haystack.includes(term))) return false;
      }

      return true;
    });
  }, [communityBobbleheads, query, teamFilter, yearFilter]);

  const hasActiveFilters = query.trim().length > 0 || teamFilter !== "" || yearFilter !== "";

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
        <AuthWidget />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6">
        <header className="mb-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-500/80 sm:text-xs">
            Recently added by the community
          </p>
        </header>

        {!isLoading && communityBobbleheads.length > 0 ? (
          <div className="mb-6">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <label className="min-w-0">
                <span className="text-xs font-black uppercase tracking-wide text-amber-300">Search</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by player, team…"
                  aria-label="Search recently added bobbleheads"
                  className={FIELD_CLASSES}
                />
              </label>
              <label className="min-w-0">
                <span className="text-xs font-black uppercase tracking-wide text-amber-300">Team</span>
                <select
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value)}
                  aria-label="Filter by team"
                  className={FIELD_CLASSES}
                >
                  <option value="">All teams</option>
                  {teamOptions.map((team) => (
                    <option key={team.slug} value={team.slug}>
                      {team.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="text-xs font-black uppercase tracking-wide text-amber-300">Year</span>
                <select
                  value={yearFilter}
                  onChange={(event) => setYearFilter(event.target.value)}
                  aria-label="Filter by year"
                  className={FIELD_CLASSES}
                >
                  <option value="">All years</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-400">
                Showing {filtered.length} of {communityBobbleheads.length}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setTeamFilter("");
                    setYearFilter("");
                  }}
                  className="text-xs font-semibold uppercase tracking-wide text-zinc-400 transition hover:text-amber-300"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {isLoading ? null : communityBobbleheads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 bg-black/15 p-8 text-center">
            <p className="text-sm font-black uppercase tracking-wide text-zinc-100">
              Nothing added yet
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 bg-black/15 p-8 text-center">
            <p className="text-sm font-black uppercase tracking-wide text-zinc-100">No matches</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Try a different search term or filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {filtered.map((bobblehead) => (
              <RecentlyAddedCard key={bobblehead.id} bobblehead={bobblehead} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
