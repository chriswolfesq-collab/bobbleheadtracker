"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BobbleheadImage } from "@/components/BobbleheadImage";
import { useAllApprovedPhotos } from "@/lib/approvedPhotos";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
import { publicAsset } from "@/lib/paths";
import { searchGiveaways, type SearchResult } from "@/lib/search";
import { getTeamBySlug } from "@/lib/teams";
import { useSearchIndex } from "@/lib/useSearchIndex";

// Effectively "no limit": the dropdown caps at 20, this page shows everything.
const PAGE_RESULT_LIMIT = 1000;

function ResultCard({ result, photoUrl }: { result: SearchResult; photoUrl?: string }) {
  const imageSrc = photoUrl || result.imageUrl || publicAsset(`/bobbleheads/${result.teamSlug}.png`);

  return (
    <Link
      href={result.href}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex h-28 items-end justify-center px-2 pt-2 sm:h-32">
        <BobbleheadImage
          src={imageSrc}
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
  const results = useMemo(() => searchGiveaways(index, query, PAGE_RESULT_LIMIT), [index, query]);

  // Keep the URL shareable/bookmarkable as the user refines the query. The
  // native History API integrates with the Next router, so this doesn't
  // trigger a navigation on every keystroke.
  const updateQuery = (value: string) => {
    setQuery(value);
    const params = new URLSearchParams();
    if (value.trim()) params.set("q", value.trim());
    if (team) params.set("team", team.slug);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  };

  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <div className="flex items-center justify-between px-4 pt-4 sm:px-6">
        <Link
          href={team ? `/teams/${team.slug}` : "/"}
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 transition hover:text-accent-hover"
        >
          <span aria-hidden>←</span> {team ? `Back to ${team.name}` : "Back to home"}
        </Link>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6">
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
          <p className="text-center text-sm text-zinc-600">
            Type above to search the whole catalog.
          </p>
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
              {results.length === 1 ? "1 result" : `${results.length} results`} for “{query.trim()}”
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {results.map((result) => (
                <ResultCard
                  key={`${result.source}-${result.teamSlug}-${result.id}`}
                  result={result}
                  photoUrl={photoUrlByListing[`${result.teamSlug}/${result.id}`]}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
