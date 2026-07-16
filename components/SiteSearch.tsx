"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDeletedBobbleheads } from "@/lib/bobbleheadOverrides";
import { useAllCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { publicAsset } from "@/lib/paths";
import { CURATED_SEARCH_INDEX, searchGiveaways, type SearchResult } from "@/lib/search";
import { getTeamBySlug } from "@/lib/teams";

export function SiteSearch({ teamSlug }: { teamSlug?: string } = {}) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { communityBobbleheads } = useAllCommunityBobbleheads();
  const { isDeleted } = useDeletedBobbleheads();

  const index = useMemo<SearchResult[]>(() => {
    const community: SearchResult[] = communityBobbleheads.map((giveaway) => {
      const team = getTeamBySlug(giveaway.teamSlug);
      return {
        id: giveaway.id,
        title: giveaway.title,
        date: giveaway.date,
        year: giveaway.year,
        imageUrl: giveaway.imageUrl,
        teamSlug: giveaway.teamSlug,
        teamName: team?.name ?? giveaway.teamSlug,
        teamCity: team?.city ?? "",
        href: `/teams/${giveaway.teamSlug}/community?id=${encodeURIComponent(giveaway.id)}`,
        source: "community",
      };
    });

    const curated = CURATED_SEARCH_INDEX.filter((result) => !isDeleted(result.teamSlug, result.id));
    const combined = [...curated, ...community];
    return teamSlug ? combined.filter((result) => result.teamSlug === teamSlug) : combined;
  }, [communityBobbleheads, teamSlug, isDeleted]);

  const results = useMemo(() => searchGiveaways(index, query), [index, query]);
  const showResults = isFocused && query.trim().length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-md px-4 sm:px-0">
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
        >
          ⌕
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={teamSlug ? "Search this team's players, dates…" : "Search players, teams, dates…"}
          aria-label="Search bobbleheads"
          className="w-full rounded-full border border-white/15 bg-[#101827]/70 py-2.5 pl-10 pr-4 text-sm text-white outline-none backdrop-blur transition placeholder:text-zinc-500 focus:border-amber-400"
        />
      </div>

      {showResults ? (
        <div className="absolute left-4 right-4 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-lg border border-white/15 bg-[#0b1626] shadow-2xl sm:left-0 sm:right-0">
          {results.length > 0 ? (
            <ul>
              {results.map((result) => (
                <li key={`${result.source}-${result.teamSlug}-${result.id}`}>
                  <Link
                    href={result.href}
                    onClick={() => setIsFocused(false)}
                    className="flex items-center gap-3 border-b border-white/5 px-3 py-2 last:border-0 hover:bg-white/5"
                  >
                    <Image
                      src={result.imageUrl || publicAsset(`/bobbleheads/${result.teamSlug}.png`)}
                      alt=""
                      width={30}
                      height={70}
                      unoptimized={!!result.imageUrl?.startsWith("http")}
                      className="h-9 w-auto shrink-0 object-contain"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{result.title}</p>
                      <p className="truncate text-xs text-zinc-400">
                        {teamSlug ? result.date : `${result.teamCity} ${result.teamName} · ${result.date}`}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-center text-sm text-zinc-400">No bobbleheads found.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
