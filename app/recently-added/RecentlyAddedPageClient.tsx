"use client";

import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RecentlyAddedCard } from "@/components/RecentlyAddedCard";
import { ToggleChip } from "@/components/ToggleChip";
import { useAllApprovedPhotos } from "@/lib/approvedPhotos";
import { bobbleheadHref } from "@/lib/bobbleheadIdentity";
import { useAllCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { extractYear, UNKNOWN_YEAR } from "@/lib/extractYear";
import { saveListingTrail } from "@/lib/listingTrail";
import { getTeamBySlug } from "@/lib/teams";
import { useMyOwnedLookup } from "@/lib/userCollections";
import { useMyWantedLookup } from "@/lib/userWanted";

// How many cards to render at once. The full filtered list can be hundreds of
// items; rendering a page at a time and growing on demand keeps the initial
// DOM (and its images) small without a server round-trip per filter change.
const PAGE_SIZE = 48;
const FIELD_CLASSES =
  "mt-1 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent";

type SortOrder = "newest" | "oldest" | "name";
type OwnedFilter = "all" | "owned" | "unowned";

const SORT_ORDERS: SortOrder[] = ["newest", "oldest", "name"];
const OWNED_FILTERS: OwnedFilter[] = ["all", "owned", "unowned"];

// Search, filters, sort and how far "show more" has grown all live in the URL
// (via replaceState, so no navigation per keystroke). That makes a filtered view
// shareable and — the reason it's here — means opening a listing and pressing
// Back restores what you were looking at instead of resetting to the newest 48.
// Same approach as the team collection; see
// app/teams/[slug]/BobbleheadCollection.tsx.
function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get("sort") as SortOrder | null;
  const owned = params.get("owned") as OwnedFilter | null;
  return {
    query: params.get("q") ?? "",
    team: params.get("team") ?? "",
    year: params.get("year") ?? "",
    wanted: params.get("wanted") === "1",
    owned: owned && OWNED_FILTERS.includes(owned) ? owned : "all",
    sort: sort && SORT_ORDERS.includes(sort) ? sort : "newest",
    // Rounded to whole pages and floored at one, so a hand-edited or truncated
    // ?shown= can't leave the grid showing a partial page or nothing at all.
    shown:
      Math.max(1, Math.round((Number(params.get("shown")) || PAGE_SIZE) / PAGE_SIZE)) * PAGE_SIZE,
  };
}

// The search/filter/sort state flattened into one comparable string. Used during
// render to notice an edit and shrink the window — and by the URL restore, which
// has to claim the signature it just restored, or the restore itself reads as an
// edit and throws away the `?shown=` beside it.
function filterSignatureOf(state: {
  query: string;
  team: string;
  year: string;
  wanted: boolean;
  owned: OwnedFilter;
  sort: SortOrder;
}): string {
  return `${state.query}|${state.team}|${state.year}|${state.wanted}|${state.owned}|${state.sort}`;
}

export function RecentlyAddedPageClient() {
  // Every community listing, not the newest N. This page filters, searches and
  // sorts across the whole set — including oldest-first — so a fetch capped at
  // 200 left the oldest listings unreachable by any of it, and reported the cap
  // as the total ("of 200") while there were 226. The homepage strip next door
  // genuinely does want the newest ten; this is the page that holds all of them.
  const { communityBobbleheads, isLoading } = useAllCommunityBobbleheads();
  // Same reason the search grid loads these: a listing's own image_url is only
  // one of its photos, and not the one the listing page shows. An admin can
  // approve a better photo — or replace one whose file has since gone — and
  // until this map is consulted the cards here keep pointing at the old URL.
  const photoUrlByListing = useAllApprovedPhotos();
  const { wantedByKey, isLoggedIn: isLoggedInForWanted, setWanted } = useMyWantedLookup();
  const { ownedByKey, isLoggedIn: isLoggedInForOwned, setOwned } = useMyOwnedLookup();
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [wantedOnly, setWantedOnly] = useState(false);
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [hasRestored, setHasRestored] = useState(false);
  // The view this window size belongs to. Compared against the live signature
  // further down, to shrink back to one page when the filters change.
  const [prevFilterSignature, setPrevFilterSignature] = useState(() =>
    filterSignatureOf({ query: "", team: "", year: "", wanted: false, owned: "all", sort: "newest" }),
  );

  // Restore from the URL after mount rather than in the state initializers:
  // those also run on the server, where there is no window, and a value that
  // differs from the server-rendered default is a hydration mismatch.
  useEffect(() => {
    const url = readUrlState();
    /* eslint-disable react-hooks/set-state-in-effect */
    setQuery(url.query);
    setTeamFilter(url.team);
    setYearFilter(url.year);
    setWantedOnly(url.wanted);
    setOwnedFilter(url.owned);
    setSortOrder(url.sort);
    setVisibleCount(url.shown);
    // Adopt the restored view as the baseline the reset below compares against,
    // so it can tell a restore from a user edit.
    setPrevFilterSignature(
      filterSignatureOf({
        query: url.query,
        team: url.team,
        year: url.year,
        wanted: url.wanted,
        owned: url.owned,
        sort: url.sort,
      }),
    );
    setHasRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // The current view as a query string.
  const view = useMemo(() => {
    const params = new URLSearchParams();
    const setUnlessDefault = (key: string, value: string, defaultValue: string) => {
      if (value !== defaultValue) params.set(key, value);
    };
    setUnlessDefault("q", query, "");
    setUnlessDefault("team", teamFilter, "");
    setUnlessDefault("year", yearFilter, "");
    setUnlessDefault("wanted", wantedOnly ? "1" : "", "");
    setUnlessDefault("owned", ownedFilter, "all");
    setUnlessDefault("sort", sortOrder, "newest");
    setUnlessDefault("shown", String(visibleCount), String(PAGE_SIZE));
    return params.toString();
  }, [query, teamFilter, yearFilter, wantedOnly, ownedFilter, sortOrder, visibleCount]);

  // Mirror every change back into the URL — but not before the restore above has
  // read it, since writing the default view first would erase the very params
  // being restored.
  useEffect(() => {
    if (!hasRestored) return;
    window.history.replaceState(null, "", `${window.location.pathname}${view ? `?${view}` : ""}`);
  }, [view, hasRestored]);

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
      if (ownedFilter === "owned" && !ownedByKey[`${bobblehead.teamSlug}:${bobblehead.id}`]) return false;
      if (ownedFilter === "unowned" && ownedByKey[`${bobblehead.teamSlug}:${bobblehead.id}`]) return false;

      if (terms.length > 0) {
        const team = getTeamBySlug(bobblehead.teamSlug);
        const haystack =
          `${bobblehead.title} ${bobblehead.nickname ?? ""} ${bobblehead.date} ${team?.name ?? ""} ${team?.city ?? ""} ${bobblehead.teamSlug}`.toLowerCase();
        if (!terms.every((term) => haystack.includes(term))) return false;
      }

      return true;
    });
  }, [communityBobbleheads, query, teamFilter, yearFilter, wantedOnly, wantedByKey, ownedFilter, ownedByKey]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortOrder === "name") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // Sorted on the field explicitly rather than leaning on the fetch order
      // (created_at desc) and reversing it — the dropdown says "added", the
      // cards show the added date, and this now says the same thing. Compared
      // as strings: Postgres hands these back as UTC ISO timestamps, so they
      // order lexicographically, and it keeps the microseconds that separate
      // rows from the same bulk import.
      const direction = sortOrder === "newest" ? -1 : 1;
      list.sort((a, b) => direction * a.createdAt.localeCompare(b.createdAt));
    }
    return list;
  }, [filtered, sortOrder]);

  // The chain a clicked listing's prev/next arrows will follow. Built from the
  // whole filtered list rather than the rendered window, so arrowing keeps
  // going past wherever "show more" happened to stop.
  const trailEntries = useMemo(
    () =>
      sorted.map((bobblehead) => ({
        id: bobblehead.id,
        title: bobblehead.title,
        href: bobbleheadHref(bobblehead.teamSlug, bobblehead.id, false),
      })),
    [sorted],
  );

  const hasActiveFilters =
    query.trim().length > 0 || teamFilter !== "" || yearFilter !== "" || wantedOnly || ownedFilter !== "all";

  // Reset the window whenever the filters change, so a new search starts from
  // the top rather than deep in a previous result's "show more" state. Done by
  // comparing against the previous filter signature during render (React's
  // "adjust state during render" pattern) rather than in an effect.
  const filterSignature = filterSignatureOf({
    query,
    team: teamFilter,
    year: yearFilter,
    wanted: wantedOnly,
    owned: ownedFilter,
    sort: sortOrder,
  });
  if (prevFilterSignature !== filterSignature) {
    setPrevFilterSignature(filterSignature);
    setVisibleCount(PAGE_SIZE);
  }

  const visible = sorted.slice(0, visibleCount);

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6">
        {/* The trail replaces the old "← Back to home" link: it goes to the same
            place and also says where you are. */}
        <Breadcrumbs
          className="mb-4"
          items={[{ href: "/", label: "Home" }, { label: "Recently Added" }]}
        />
        <header className="mb-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent/80 sm:text-xs">
            Recently added by the community
          </p>
        </header>

        {!isLoading && communityBobbleheads.length > 0 ? (
          <div className="mb-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="min-w-0">
                <span className="text-xs font-black uppercase tracking-wide text-accent">
                  Search
                </span>
                <div className="relative mt-1">
                  {/* WebKit draws its own ✕ inside a search input, which landed
                      on top of the one below and gave the field two clear
                      buttons. `appearance-none` drops the native one; ours stays
                      because it's styled and carries a label. */}
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by player, team…"
                    aria-label="Search recently added bobbleheads"
                    className="w-full rounded border border-black/10 bg-white px-3 py-2 pr-9 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent [&::-webkit-search-cancel-button]:appearance-none"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 transition hover:text-accent-hover"
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
              {isLoggedInForOwned ? (
                <label className="min-w-0">
                  <span className="text-xs font-black uppercase tracking-wide text-accent">Ownership</span>
                  <select
                    value={ownedFilter}
                    onChange={(event) => setOwnedFilter(event.target.value as "all" | "owned" | "unowned")}
                    aria-label="Filter by ownership"
                    className={FIELD_CLASSES}
                  >
                    <option value="all">All</option>
                    <option value="owned">Owned</option>
                    <option value="unowned">Unowned</option>
                  </select>
                </label>
              ) : null}
              <label className="min-w-0">
                <span className="text-xs font-black uppercase tracking-wide text-accent">Sort</span>
                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest" | "name")}
                  aria-label="Sort"
                  className={FIELD_CLASSES}
                >
                  {/* "added", not just "newest" — the giveaway date on each
                      card is a different date entirely, and unlabelled options
                      read as if they sort by that one. */}
                  <option value="newest">Newest added</option>
                  <option value="oldest">Oldest added</option>
                  <option value="name">Name (A–Z)</option>
                </select>
              </label>
              <div className="flex items-end">
                <ToggleChip label="Wanted" active={wantedOnly} onClick={() => setWantedOnly((v) => !v)} />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-600">
                Showing {visible.length} of {filtered.length}
                {filtered.length !== communityBobbleheads.length
                  ? ` (${communityBobbleheads.length} total)`
                  : ""}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setTeamFilter("");
                    setYearFilter("");
                    setWantedOnly(false);
                    setOwnedFilter("all");
                  }}
                  className="text-xs font-semibold uppercase tracking-wide text-zinc-600 transition hover:text-accent-hover"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {isLoading ? null : communityBobbleheads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/10 bg-black/15 p-8 text-center">
            <p className="text-sm font-black uppercase tracking-wide text-zinc-900">
              Nothing added yet
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/10 bg-black/15 p-8 text-center">
            <p className="text-sm font-black uppercase tracking-wide text-zinc-900">No matches</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Try a different search term or filter.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {visible.map((bobblehead, index) => {
                const key = `${bobblehead.teamSlug}:${bobblehead.id}`;
                const isWanted = wantedByKey[key] ?? false;
                return (
                  <RecentlyAddedCard
                    key={bobblehead.id}
                    bobblehead={bobblehead}
                    // `visible` is a prefix of `sorted`, so the index lines up.
                    onNavigate={() => saveListingTrail("Recently Added", trailEntries, index)}
                    photoUrl={photoUrlByListing[`${bobblehead.teamSlug}/${bobblehead.id}`]}
                    isWanted={isWanted}
                    isLoggedIn={isLoggedInForWanted}
                    onToggleWanted={() => {
                      // Owned and wanted are mutually exclusive everywhere else
                      // (team cards, listing pages); this star has to keep the
                      // same promise or it can put an item in both states.
                      if (!isWanted && (ownedByKey[key] ?? false)) {
                        setOwned(bobblehead.teamSlug, bobblehead.id, false);
                      }
                      setWanted(bobblehead.teamSlug, bobblehead.id, !isWanted);
                    }}
                  />
                );
              })}
            </div>
            {visible.length < filtered.length ? (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  className="rounded-full border border-black/10 bg-black/[0.04] px-5 py-2 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover"
                >
                  Show more ({filtered.length - visible.length} more)
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
