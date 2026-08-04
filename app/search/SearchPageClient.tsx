"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BobbleheadImage } from "@/components/BobbleheadImage";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useAllApprovedPhotos } from "@/lib/approvedPhotos";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
import { publicAsset } from "@/lib/paths";
import { searchGiveaways, type SearchResult } from "@/lib/search";
import { getTeamBySlug } from "@/lib/teams";
import { useSearchIndex } from "@/lib/useSearchIndex";

// How many cards to render at once, matching /recently-added. A broad query
// ("s", "20") matches thousands of listings, and this page used to hand every
// one of them to the DOM at once — which is why it capped the search itself at
// 1000 and then reported that cap as the result count. Paging the render is
// what lets the search stay uncapped.
const PAGE_SIZE = 48;

// How far "show more" has grown, read back off the URL. Rounded to whole pages
// and floored at one, so a hand-edited or truncated ?shown= can't leave the grid
// showing a partial page or nothing at all.
function readShown(raw: string | null): number {
  return Math.max(1, Math.round((Number(raw) || PAGE_SIZE) / PAGE_SIZE)) * PAGE_SIZE;
}

function ResultCard({ result, photoUrl }: { result: SearchResult; photoUrl?: string }) {
  const placeholderSrc = publicAsset(`/bobbleheads/${result.teamSlug}.png`);
  const imageSrc = photoUrl || result.imageUrl || placeholderSrc;

  return (
    <Link
      href={result.href}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex h-28 items-end justify-center px-2 pt-2 sm:h-32">
        <BobbleheadImage
          src={imageSrc}
          fallbackSrc={placeholderSrc}
          alt={`${result.title} bobblehead`}
          width={268}
          height={630}
          unoptimized={isUnoptimizedImage(imageSrc)}
          className="h-24 w-auto object-contain mix-blend-multiply drop-shadow-[0_8px_10px_rgba(58,36,18,0.35)] sm:h-28"
        />
      </div>
      <div className="flex flex-1 flex-col px-2 py-2 text-center">
        <p className="truncate text-[11px] font-bold leading-tight text-zinc-900 sm:text-xs">
          {result.title}
        </p>
        {result.nickname ? (
          <p className="truncate text-[10px] font-semibold text-zinc-600 sm:text-[11px]">
            “{result.nickname}”
          </p>
        ) : null}
        <div className="mt-auto pt-1 text-[9px] uppercase tracking-wide text-zinc-600 sm:text-[10px]">
          <p className="truncate">
            {result.teamCity} {result.teamName}
          </p>
          <p className="truncate">{result.date}</p>
        </div>
      </div>
    </Link>
  );
}

export function SearchPageClient() {
  const searchParams = useSearchParams();
  const teamSlug = searchParams.get("team") ?? undefined;
  const team = teamSlug ? getTeamBySlug(teamSlug) : undefined;
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const index = useSearchIndex(team ? team.slug : undefined);
  const photoUrlByListing = useAllApprovedPhotos();
  // The index itself is the only ceiling — a search can't match more listings
  // than exist, so this is "everything that matched" with a finite number.
  const results = useMemo(() => searchGiveaways(index, query, index.length), [index, query]);

  // Reset the window when the query changes, so refining a search starts at the
  // top rather than deep in the previous one's "show more" state. Compared
  // during render (React's "adjust state during render" pattern) rather than in
  // an effect, same as /recently-added.
  const [visibleCount, setVisibleCount] = useState(() => readShown(searchParams.get("shown")));
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setVisibleCount(PAGE_SIZE);
  }

  const visible = results.slice(0, visibleCount);

  // Keep the URL shareable/bookmarkable as the user refines the query — and
  // carry the window in it too, so opening a result and pressing Back comes back
  // to the same depth in the list rather than to the first page of it. The
  // native History API integrates with the Next router, so this doesn't
  // trigger a navigation on every keystroke.
  const writeUrl = (value: string, shown: number) => {
    const params = new URLSearchParams();
    if (value.trim()) params.set("q", value.trim());
    if (team) params.set("team", team.slug);
    if (shown !== PAGE_SIZE) params.set("shown", String(shown));
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    // A new query shrinks the window back to one page above, so the URL has to
    // say the same rather than keep the previous search's depth.
    writeUrl(value, PAGE_SIZE);
  };

  const showMore = () => {
    const next = visibleCount + PAGE_SIZE;
    setVisibleCount(next);
    writeUrl(query, next);
  };

  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6">
        {/* A team-scoped search keeps that team in the trail, so the crumb that
            replaces the old "← Back to <team>" link still leads back to it. */}
        <Breadcrumbs
          className="mb-4"
          items={[
            { href: "/", label: "Home" },
            ...(team
              ? [
                  { href: "/teams", label: "Teams" },
                  { href: `/teams/${team.slug}`, label: team.name },
                ]
              : []),
            { label: "Search" },
          ]}
        />
        <header className="mb-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent/80 sm:text-xs">
            Search results
          </p>
        </header>

        <div className="mx-auto mb-6 max-w-xl">
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600"
            >
              ⌕
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder={team ? `Search ${team.name} players, dates…` : "Search players, teams, dates…"}
              aria-label="Search bobbleheads"
              className="w-full rounded-full border border-black/10 bg-white/70 py-2.5 pl-10 pr-4 text-sm text-zinc-900 outline-none backdrop-blur transition placeholder:text-zinc-500 focus:border-accent [&::-webkit-search-cancel-button]:appearance-none"
            />
          </div>
          {team ? (
            <p className="mt-2 text-center text-xs text-zinc-600">
              Searching the {team.city} {team.name} only.{" "}
              <Link
                href={`/search?q=${encodeURIComponent(query.trim())}`}
                className="font-semibold text-accent hover:text-accent-hover"
              >
                Search all teams
              </Link>
            </p>
          ) : null}
        </div>

        {query.trim().length === 0 ? (
          // Arriving here from the homepage's "Search All" with nothing typed
          // is a dead end otherwise, so offer the two browse routes.
          <div className="text-center">
            <p className="text-sm text-zinc-600">Type above to search the whole catalog.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
              <Link
                href="/teams"
                className="font-semibold text-accent hover:text-accent-hover"
              >
                Browse by team
              </Link>
              <Link
                href="/recently-added"
                className="font-semibold text-accent hover:text-accent-hover"
              >
                Recently added
              </Link>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-lg border border-dashed border-black/10 bg-black/15 p-8 text-center">
            <p className="text-sm font-black uppercase tracking-wide text-zinc-900">
              No bobbleheads found
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Try a different player, team, or year.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-zinc-600">
              {visible.length < results.length
                ? `Showing ${visible.length} of ${results.length} results`
                : results.length === 1
                  ? "1 result"
                  : `${results.length} results`}{" "}
              for “{query.trim()}”
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {visible.map((result) => (
                <ResultCard
                  key={`${result.source}-${result.teamSlug}-${result.id}`}
                  result={result}
                  photoUrl={photoUrlByListing[`${result.teamSlug}/${result.id}`]}
                />
              ))}
            </div>
            {visible.length < results.length ? (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={showMore}
                  className="rounded-full border border-black/10 bg-black/[0.04] px-5 py-2 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover"
                >
                  Show more ({results.length - visible.length} more)
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
