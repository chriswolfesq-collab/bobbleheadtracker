"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuthWidget } from "@/components/AuthWidget";
import { RecentlyAddedCard } from "@/components/RecentlyAddedCard";
import { ToggleChip } from "@/components/ToggleChip";
import { useRecentCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { getTeamBySlug } from "@/lib/teams";
import { useMyWantedLookup } from "@/lib/userWanted";

const RECENT_LIMIT = 200;
const UNKNOWN_YEAR = "Unknown";
const FIELD_CLASSES =
  "mt-1 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent dark:border-white/15 dark:bg-[#07111d] dark:text-white";

function extractYear(date: string): string {
  const match = date.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : UNKNOWN_YEAR;
}

export function RecentlyAddedPageClient() {
  const { communityBobbleheads, isLoading } = useRecentCommunityBobbleheads(RECENT_LIMIT);
  const { wantedByKey, isLoggedIn: isLoggedInForWanted, setWanted } = useMyWantedLookup();
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [wantedOnly, setWantedOnly] = useState(false);

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
      if (wantedOnly && !wantedByKey[`${bobblehead.teamSlug}:${bobblehead.id}`]) return false;

      if (terms.length > 0) {
        const team = getTeamBySlug(bobblehead.teamSlug);
        const haystack = `${bobblehead.title} ${bobblehead.date} ${team?.name ?? ""} ${team?.city ?? ""} ${bobblehead.teamSlug}`.toLowerCase();
        if (!terms.every((term) => haystack.includes(term))) return false;
      }

      return true;
    });
  }, [communityBobbleheads, query, teamFilter, yearFilter, wantedOnly, wantedByKey]);

  const hasActiveFilters =
    query.trim().length > 0 || teamFilter !== "" || yearFilter !== "" || wantedOnly;

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
        <AuthWidget />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6">
        <header className="mb-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent/80 sm:text-xs">
            Recently added by the community
          </p>
        </header>

        {!isLoading && communityBobbleheads.length > 0 ? (
          <div className="mb-6">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="min-w-0">
                <span className="text-xs font-black uppercase tracking-wide text-accent">
                  Search
                </span>
                <div className="relative mt-1">
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by player, team…"
                    aria-label="Search recently added bobbleheads"
                    className="w-full rounded border border-black/10 bg-white px-3 py-2 pr-9 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent dark:border-white/15 dark:bg-[#07111d] dark:text-white"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 transition hover:text-accent-hover dark:text-zinc-400 dark:hover:text-accent-hover"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              </label>
              <label className="min-w-0">
                <span className="text-xs font-black uppercase tracking-wide text-accent">Team</span>
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
                <span className="text-xs font-black uppercase tracking-wide text-accent">Year</span>
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
              <div className="flex items-end">
                <ToggleChip label="Wanted" active={wantedOnly} onClick={() => setWantedOnly((v) => !v)} />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Showing {filtered.length} of {communityBobbleheads.length}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setTeamFilter("");
                    setYearFilter("");
                    setWantedOnly(false);
                  }}
                  className="text-xs font-semibold uppercase tracking-wide text-zinc-600 transition hover:text-accent-hover dark:text-zinc-400 dark:hover:text-accent-hover"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {isLoading ? null : communityBobbleheads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/10 bg-black/15 p-8 text-center dark:border-white/15">
            <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
              Nothing added yet
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/10 bg-black/15 p-8 text-center dark:border-white/15">
            <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">No matches</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Try a different search term or filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {filtered.map((bobblehead) => {
              const key = `${bobblehead.teamSlug}:${bobblehead.id}`;
              return (
                <RecentlyAddedCard
                  key={bobblehead.id}
                  bobblehead={bobblehead}
                  isWanted={wantedByKey[key] ?? false}
                  isLoggedIn={isLoggedInForWanted}
                  onToggleWanted={() => setWanted(bobblehead.teamSlug, bobblehead.id, !(wantedByKey[key] ?? false))}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
