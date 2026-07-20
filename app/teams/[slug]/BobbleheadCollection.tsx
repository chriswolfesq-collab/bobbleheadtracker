"use client";

import { useMemo, useState } from "react";
import { SiteSearch } from "@/components/SiteSearch";
import { ToggleChip } from "@/components/ToggleChip";
import type { Team } from "@/lib/teams";
import { GiveawayCard, type ResolvedGiveaway, useFavorites, useOwnership, useWanted } from "./GiveawayCard";

const UNKNOWN_YEAR = "Unknown";
const FIELD_CLASSES =
  "mt-1 w-full rounded border border-white/15 bg-[#07111d] px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400";

type OwnedFilter = "all" | "owned" | "unowned";

export type SortOrder = "date-desc" | "date-asc" | "title-asc";

export const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "date-desc", label: "Release date (newest)" },
  { value: "date-asc", label: "Release date (oldest)" },
  { value: "title-asc", label: "Name (A–Z)" },
];

export const DEFAULT_SORT_ORDER: SortOrder = "date-desc";

// The catalog stores release dates as human-readable strings ("April 11, 2026").
// Parse to a timestamp for sorting, falling back to the year, then to 0 so
// undated entries sink to the bottom rather than breaking the comparator.
function releaseTime(giveaway: ResolvedGiveaway): number {
  const parsed = Date.parse(giveaway.date);
  if (!Number.isNaN(parsed)) return parsed;
  const year = Number(giveaway.year);
  return Number.isNaN(year) ? 0 : Date.parse(`January 1, ${year}`);
}

export function BobbleheadCollection({
  allGiveaways,
  team,
  sortOrder,
}: {
  allGiveaways: ResolvedGiveaway[];
  team: Team;
  sortOrder: SortOrder;
}) {
  const { ownedById } = useOwnership();
  const { favoritedById } = useFavorites();
  const { wantedById } = useWanted();

  const [yearFilter, setYearFilter] = useState("");
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>("all");
  const [hasPhotoOnly, setHasPhotoOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [wantedOnly, setWantedOnly] = useState(false);

  const yearOptions = useMemo(() => {
    const years = new Set(allGiveaways.map((giveaway) => giveaway.year || UNKNOWN_YEAR));
    return Array.from(years).sort((a, b) => {
      if (a === UNKNOWN_YEAR) return 1;
      if (b === UNKNOWN_YEAR) return -1;
      return b.localeCompare(a);
    });
  }, [allGiveaways]);

  const filtered = useMemo(() => {
    return allGiveaways.filter((giveaway) => {
      if (yearFilter && (giveaway.year || UNKNOWN_YEAR) !== yearFilter) return false;
      if (ownedFilter === "owned" && !ownedById[giveaway.id]) return false;
      if (ownedFilter === "unowned" && ownedById[giveaway.id]) return false;
      if (hasPhotoOnly && !giveaway.imageUrl) return false;
      if (favoritesOnly && !favoritedById[giveaway.id]) return false;
      if (wantedOnly && !wantedById[giveaway.id]) return false;
      return true;
    });
  }, [allGiveaways, yearFilter, ownedFilter, hasPhotoOnly, favoritesOnly, wantedOnly, ownedById, favoritedById, wantedById]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortOrder === "title-asc") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      list.sort((a, b) => {
        const newestFirst = releaseTime(b) - releaseTime(a);
        return sortOrder === "date-asc" ? -newestFirst : newestFirst;
      });
    }
    return list;
  }, [filtered, sortOrder]);

  const hasActiveFilters =
    yearFilter !== "" || ownedFilter !== "all" || hasPhotoOnly || favoritesOnly || wantedOnly;

  const clearFilters = () => {
    setYearFilter("");
    setOwnedFilter("all");
    setHasPhotoOnly(false);
    setFavoritesOnly(false);
    setWantedOnly(false);
  };

  return (
    <div>
      <div className="mb-5">
        <div className="mb-3 flex justify-start">
          <SiteSearch teamSlug={team.slug} buttonLabel={`Search ${team.name}`} variant="inline" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto]">
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
          <label className="min-w-0">
            <span className="text-xs font-black uppercase tracking-wide text-amber-300">Ownership</span>
            <select
              value={ownedFilter}
              onChange={(event) => setOwnedFilter(event.target.value as OwnedFilter)}
              aria-label="Filter by ownership"
              className={FIELD_CLASSES}
            >
              <option value="all">All</option>
              <option value="owned">Owned</option>
              <option value="unowned">Unowned</option>
            </select>
          </label>
          <div className="flex items-end">
            <ToggleChip label="Has photo" active={hasPhotoOnly} onClick={() => setHasPhotoOnly((v) => !v)} />
          </div>
          <div className="flex items-end">
            <ToggleChip label="Favorites" active={favoritesOnly} onClick={() => setFavoritesOnly((v) => !v)} />
          </div>
          <div className="flex items-end">
            <ToggleChip label="Wanted" active={wantedOnly} onClick={() => setWantedOnly((v) => !v)} />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">
            Showing {filtered.length} of {allGiveaways.length}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold uppercase tracking-wide text-zinc-400 transition hover:text-amber-300"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {sorted.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
          {sorted.map((giveaway) => (
            <GiveawayCard
              key={giveaway.id}
              giveaway={giveaway}
              team={team}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-white/15 bg-black/15 p-8 text-center">
          <p className="text-sm font-black uppercase tracking-wide text-zinc-100">No matches</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Try a different filter.</p>
        </div>
      )}
    </div>
  );
}
