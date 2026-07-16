"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBobbleheadOverrides } from "@/lib/bobbleheadOverrides";
import { useAllCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { publicAsset } from "@/lib/paths";
import { CURATED_SEARCH_INDEX, searchGiveaways, type SearchResult } from "@/lib/search";
import { getTeamBySlug } from "@/lib/teams";

export function SiteSearch({
  teamSlug,
  buttonLabel = "Search",
  variant = "centered",
}: { teamSlug?: string; buttonLabel?: string; variant?: "centered" | "inline" } = {}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { communityBobbleheads } = useAllCommunityBobbleheads();
  const { isDeleted, getOverride } = useBobbleheadOverrides();

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

    // Curated entries are indexed from build-time data, so admin edits
    // (bobblehead_overrides) have to be applied here or search would keep
    // matching and showing the pre-edit title/year/date.
    const curated = CURATED_SEARCH_INDEX.filter((result) => !isDeleted(result.teamSlug, result.id)).map(
      (result) => {
        const override = getOverride(result.teamSlug, result.id);
        if (!override) return result;
        return {
          ...result,
          title: override.title ?? result.title,
          year: override.year ?? result.year,
          date: override.date ?? result.date,
        };
      },
    );
    const combined = [...curated, ...community];
    return teamSlug ? combined.filter((result) => result.teamSlug === teamSlug) : combined;
  }, [communityBobbleheads, teamSlug, isDeleted, getOverride]);

  const results = useMemo(() => searchGiveaways(index, query), [index, query]);
  const showResults = isFocused && query.trim().length > 0;

  const closeSearch = () => {
    setIsFocused(false);
    setIsOpen(false);
    setQuery("");
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      closeSearch();
      return;
    }

    if (!showResults || results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1 < results.length ? current + 1 : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current > 0 ? current - 1 : results.length - 1));
    } else if (event.key === "Enter") {
      const active = results[activeIndex] ?? results[0];
      event.preventDefault();
      setIsFocused(false);
      router.push(active.href);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        if (query.trim().length === 0) setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [query]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) {
    return (
      <div
        className={
          variant === "inline"
            ? "min-w-0 max-w-xs flex-1"
            : "mx-auto w-full max-w-md px-4 text-center sm:px-0"
        }
      >
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setIsFocused(true);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#101827]/70 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:border-amber-400 hover:text-amber-300"
        >
          <span aria-hidden>⌕</span>
          {buttonLabel}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={
        variant === "inline"
          ? "relative min-w-0 max-w-xs flex-1"
          : "relative mx-auto w-full max-w-md px-4 sm:px-0"
      }
    >
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
        >
          ⌕
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={teamSlug ? "Search this team's players, dates…" : "Search players, teams, dates…"}
          aria-label="Search bobbleheads"
          role="combobox"
          aria-expanded={showResults}
          aria-controls="site-search-results"
          aria-activedescendant={activeIndex >= 0 ? `site-search-result-${activeIndex}` : undefined}
          className="w-full rounded-full border border-white/15 bg-[#101827]/70 py-2.5 pl-10 pr-9 text-sm text-white outline-none backdrop-blur transition placeholder:text-zinc-500 focus:border-amber-400"
        />
        <button
          type="button"
          onClick={closeSearch}
          aria-label="Close search"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-amber-300"
        >
          ✕
        </button>
      </div>

      {showResults ? (
        <div className="absolute left-4 right-4 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-lg border border-white/15 bg-[#0b1626] shadow-2xl sm:left-0 sm:right-0">
          {results.length > 0 ? (
            <ul id="site-search-results" role="listbox">
              {results.map((result, resultIndex) => (
                <li
                  key={`${result.source}-${result.teamSlug}-${result.id}`}
                  id={`site-search-result-${resultIndex}`}
                  role="option"
                  aria-selected={resultIndex === activeIndex}
                  ref={
                    resultIndex === activeIndex
                      ? (element) => element?.scrollIntoView({ block: "nearest" })
                      : undefined
                  }
                >
                  <Link
                    href={result.href}
                    onClick={() => setIsFocused(false)}
                    onMouseEnter={() => setActiveIndex(resultIndex)}
                    className={`flex items-center gap-3 border-b border-white/5 px-3 py-2 last:border-0 ${
                      resultIndex === activeIndex ? "bg-white/5" : ""
                    }`}
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
