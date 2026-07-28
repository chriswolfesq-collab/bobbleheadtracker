"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SiteSearch } from "@/components/SiteSearch";
import { ToggleChip } from "@/components/ToggleChip";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs } from "@/components/ui/Tabs";
import type { Team } from "@/lib/teams";
import { GiveawayCard, type ResolvedGiveaway, useFavorites, useOwnership, useWanted } from "./GiveawayCard";

const UNKNOWN_YEAR = "Unknown";
const FIELD_CLASSES =
  "mt-1 w-full rounded border border-border-soft bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent";

type TabKey = "all" | "owned" | "unowned" | "wishlist";

export type SortOrder = "date-desc" | "date-asc" | "title-asc";

export const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "date-desc", label: "Newest First" },
  { value: "date-asc", label: "Oldest First" },
  { value: "title-asc", label: "Name (A–Z)" },
];

export const DEFAULT_SORT_ORDER: SortOrder = "date-desc";

const TABS: { value: TabKey; label: string }[] = [
  { value: "all", label: "All Bobbleheads" },
  { value: "owned", label: "I Own" },
  { value: "unowned", label: "I Need" },
  { value: "wishlist", label: "Wishlist" },
];

// 24 divides evenly into the 2/3/4/6-column grid steps, so every full page
// ends on a complete row.
const PAGE_SIZE = 24;

// Eagerly load roughly the first two grid rows so the above-the-fold cards
// don't flash their loading skeleton.
const EAGER_CARD_COUNT = 12;

// The catalog stores release dates as human-readable strings ("April 11, 2026").
// Parse to a timestamp for sorting, falling back to the year, then to 0 so
// undated entries sink to the bottom rather than breaking the comparator.
function releaseTime(giveaway: ResolvedGiveaway): number {
  const parsed = Date.parse(giveaway.date);
  if (!Number.isNaN(parsed)) return parsed;
  const year = Number(giveaway.year);
  return Number.isNaN(year) ? 0 : Date.parse(`January 1, ${year}`);
}

// Sort by the first letter/number, ignoring leading punctuation — otherwise a
// title like `"House" (Random) Bobblehead` sorts ahead of "Aaron Judge" because
// the quotation mark orders before letters.
function titleSortKey(title: string): string {
  return title.replace(/^[^\p{L}\p{N}]+/u, "");
}

// Filter/sort/page state lives in the URL (via replaceState, so no navigation
// per change). That makes filtered views shareable and — more importantly —
// means clicking into a bobblehead and pressing Back restores the exact tab,
// filters, and page instead of dumping the user at the top of an unfiltered
// list.
function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab") as TabKey | null;
  const sort = params.get("sort") as SortOrder | null;
  return {
    tab: tab && TABS.some((t) => t.value === tab) ? tab : "all",
    sort: sort && SORT_OPTIONS.some((s) => s.value === sort) ? sort : DEFAULT_SORT_ORDER,
    year: params.get("year") ?? "",
    photo: params.get("photo") === "1",
    favorites: params.get("favorites") === "1",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

function SortMenu({
  value,
  onChange,
}: {
  value: SortOrder;
  onChange: (value: SortOrder) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const currentLabel = SORT_OPTIONS.find((option) => option.value === value)?.label ?? "";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded border border-border-soft bg-surface px-3 py-2 text-sm font-bold uppercase tracking-wide text-navy transition hover:border-accent"
      >
        {currentLabel}
        <span aria-hidden className="text-base leading-none">⌄</span>
      </button>
      {isOpen ? (
        <ul
          role="listbox"
          className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-border-soft bg-surface py-1 shadow-xl"
        >
          {SORT_OPTIONS.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide transition hover:bg-surface-muted ${
                  option.value === value ? "text-accent" : "text-zinc-700"
                }`}
              >
                {option.label}
                {option.value === value ? <span aria-hidden>✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function BobbleheadCollection({
  allGiveaways,
  team,
}: {
  allGiveaways: ResolvedGiveaway[];
  team: Team;
}) {
  const { ownedById } = useOwnership();
  const { favoritedById } = useFavorites();
  const { wantedById } = useWanted();

  const [tab, setTab] = useState<TabKey>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [yearFilter, setYearFilter] = useState("");
  const [hasPhotoOnly, setHasPhotoOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const gridTopRef = useRef<HTMLDivElement>(null);

  // Restore state from the URL after mount (state initializers can't read
  // window on the server, and diverging from the server-rendered default
  // would be a hydration mismatch). The synchronous setStates are the point:
  // one extra render immediately after mount, before paint.
  useEffect(() => {
    const url = readUrlState();
    /* eslint-disable react-hooks/set-state-in-effect */
    setTab(url.tab);
    setSortOrder(url.sort);
    setYearFilter(url.year);
    setHasPhotoOnly(url.photo);
    setFavoritesOnly(url.favorites);
    setPage(url.page);
    if (url.year || url.photo || url.favorites) setShowFilters(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Mirror every state change back into the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string, defaultValue: string) => {
      if (value === defaultValue) params.delete(key);
      else params.set(key, value);
    };
    setOrDelete("tab", tab, "all");
    setOrDelete("sort", sortOrder, DEFAULT_SORT_ORDER);
    setOrDelete("year", yearFilter, "");
    setOrDelete("photo", hasPhotoOnly ? "1" : "", "");
    setOrDelete("favorites", favoritesOnly ? "1" : "", "");
    setOrDelete("page", String(page), "1");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [tab, sortOrder, yearFilter, hasPhotoOnly, favoritesOnly, page]);

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
      if (tab === "owned" && !ownedById[giveaway.id]) return false;
      if (tab === "unowned" && ownedById[giveaway.id]) return false;
      if (tab === "wishlist" && !wantedById[giveaway.id]) return false;
      if (hasPhotoOnly && !giveaway.imageUrl) return false;
      if (favoritesOnly && !favoritedById[giveaway.id]) return false;
      return true;
    });
  }, [allGiveaways, yearFilter, tab, hasPhotoOnly, favoritesOnly, ownedById, favoritedById, wantedById]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortOrder === "title-asc") {
      list.sort((a, b) => titleSortKey(a.title).localeCompare(titleSortKey(b.title)));
    } else {
      list.sort((a, b) => {
        const newestFirst = releaseTime(b) - releaseTime(a);
        return sortOrder === "date-asc" ? -newestFirst : newestFirst;
      });
    }
    return list;
  }, [filtered, sortOrder]);

  // Reset to page 1 when the result set changes shape (filter/tab/sort edits),
  // using the adjust-state-during-render pattern rather than an effect so the
  // stale page never paints.
  const filterSignature = `${tab}|${sortOrder}|${yearFilter}|${hasPhotoOnly}|${favoritesOnly}`;
  const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature);
  if (prevFilterSignature !== filterSignature) {
    setPrevFilterSignature(filterSignature);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    gridTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const hasActiveFilters = yearFilter !== "" || hasPhotoOnly || favoritesOnly;

  const clearFilters = () => {
    setYearFilter("");
    setHasPhotoOnly(false);
    setFavoritesOnly(false);
  };

  return (
    <div>
      <div ref={gridTopRef} className="mb-5 scroll-mt-20">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs tabs={TABS} active={tab} onChange={setTab} className="min-w-0 flex-1" />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-bold uppercase tracking-wide transition ${
                showFilters || hasActiveFilters
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border-soft bg-surface text-navy hover:border-accent"
              }`}
            >
              <span aria-hidden>⚙</span> Filters
              {hasActiveFilters ? <span className="text-xs">●</span> : null}
            </button>
            <SortMenu value={sortOrder} onChange={setSortOrder} />
          </div>
        </div>

        {showFilters ? (
          <div className="mt-3 grid gap-3 rounded-lg border border-border-soft bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_minmax(0,1fr)]">
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
              <ToggleChip label="Has photo" active={hasPhotoOnly} onClick={() => setHasPhotoOnly((v) => !v)} />
            </div>
            <div className="flex items-end">
              <ToggleChip label="Favorites" active={favoritesOnly} onClick={() => setFavoritesOnly((v) => !v)} />
            </div>
            <div className="flex items-end justify-end">
              <SiteSearch teamSlug={team.slug} buttonLabel={`Search ${team.name}`} variant="inline" />
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-600">
            {sorted.length === 0
              ? "Showing 0"
              : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, sorted.length)} of ${sorted.length}`}
            {sorted.length !== allGiveaways.length ? ` (${allGiveaways.length} total)` : ""}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold uppercase tracking-wide text-zinc-600 transition hover:text-accent-hover"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {pageItems.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {pageItems.map((giveaway, index) => (
              <GiveawayCard
                key={giveaway.id}
                giveaway={giveaway}
                team={team}
                eager={currentPage === 1 && index < EAGER_CARD_COUNT}
              />
            ))}
          </div>
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={goToPage}
            className="mt-8"
          />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border-soft bg-surface p-8 text-center">
          <p className="text-sm font-black uppercase tracking-wide text-navy">No matches</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Try a different filter.</p>
        </div>
      )}
    </div>
  );
}
