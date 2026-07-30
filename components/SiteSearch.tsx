"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { BobbleheadImage } from "@/components/BobbleheadImage";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
import { publicAsset } from "@/lib/paths";
import { searchGiveaways } from "@/lib/search";
import { useSearchIndex } from "@/lib/useSearchIndex";

export function SiteSearch({
  teamSlug,
  buttonLabel = "Search",
  variant = "centered",
  compact = false,
}: {
  teamSlug?: string;
  buttonLabel?: string;
  variant?: "centered" | "inline";
  /** For a space-constrained host like the site header: the closed button
   *  drops its text label below `sm` (icon only) and never stretches, so it
   *  can't crowd the controls beside it. */
  compact?: boolean;
} = {}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const index = useSearchIndex(teamSlug);

  const results = useMemo(() => searchGiveaways(index, query), [index, query]);
  // Any typed input opens the panel — including whitespace-only, which shows
  // the "no results" message instead of silently showing nothing.
  const showResults = isFocused && query.length > 0;
  const allResultsHref = `/search?q=${encodeURIComponent(query.trim())}${
    teamSlug ? `&team=${encodeURIComponent(teamSlug)}` : ""
  }`;

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
      event.preventDefault();
      setIsFocused(false);
      // Enter on a highlighted result opens it; plain Enter goes to the full
      // results page so nothing is lost when the user comes back.
      const active = activeIndex >= 0 ? results[activeIndex] : null;
      router.push(active ? active.href : allResultsHref);
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

  // Closed, the inline wrapper holds nothing but the button. Letting it stretch
  // (`flex-1` + `min-w-0`) also lets it shrink *under* that button, so in a
  // crowded header the button spills over the controls beside it.
  const closedInlineClass = compact ? "shrink-0" : "min-w-0 max-w-xs flex-1";

  // Open, a compact host has no room to spare: below `sm` the field lifts out
  // of the row and spans it instead of being squeezed into ~80px beside the
  // sibling controls. From `sm` up it goes back to sitting inline.
  const openInlineClass = compact
    ? "absolute inset-x-4 top-1/2 z-50 -translate-y-1/2 sm:relative sm:inset-x-auto sm:top-auto sm:min-w-0 sm:max-w-xs sm:flex-1 sm:translate-y-0"
    : "relative min-w-0 max-w-xs flex-1";

  if (!isOpen) {
    return (
      <div
        className={
          variant === "inline"
            ? closedInlineClass
            : "mx-auto w-full max-w-md px-4 text-center sm:px-0"
        }
      >
        <button
          type="button"
          onClick={() => {
            // Focus must happen inside the tap gesture: iOS Safari ignores a
            // programmatic focus() that runs later in an effect, so the input
            // opens but the keyboard never appears. flushSync mounts the input
            // synchronously so we can focus it before the click event ends.
            flushSync(() => {
              setIsOpen(true);
              setIsFocused(true);
            });
            inputRef.current?.focus();
          }}
          aria-label={buttonLabel}
          className={`inline-flex shrink-0 items-center gap-2 rounded-full border border-black/10 bg-white/70 py-2.5 text-sm font-semibold text-zinc-900 backdrop-blur transition hover:border-accent hover:text-accent-hover ${
            compact ? "px-3 sm:px-5" : "px-5"
          }`}
        >
          <span aria-hidden>⌕</span>
          <span className={compact ? "hidden sm:inline" : undefined}>{buttonLabel}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={
        variant === "inline" ? openInlineClass : "relative mx-auto w-full max-w-md px-4 sm:px-0"
      }
    >
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600"
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
          className="w-full rounded-full border border-black/10 bg-white/70 py-2.5 pl-10 pr-9 text-sm text-zinc-900 outline-none backdrop-blur transition placeholder:text-zinc-500 focus:border-accent [&::-webkit-search-cancel-button]:appearance-none"
        />
        <button
          type="button"
          onClick={closeSearch}
          aria-label="Close search"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 transition hover:text-accent-hover"
        >
          ✕
        </button>
      </div>

      {showResults ? (
        <div
          className={`absolute top-full z-40 mt-2 flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-2xl sm:left-0 sm:right-0 ${
            // A compact wrapper is already inset to the field's own edges, so
            // insetting the panel again would leave it narrower than the input.
            compact ? "left-0 right-0" : "left-4 right-4"
          }`}
        >
          {results.length > 0 ? (
            // The list scrolls on its own so the "See all results" button below
            // stays pinned in view instead of sitting past 20 rows of results.
            <ul id="site-search-results" role="listbox" className="max-h-80 overflow-y-auto">
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
                    className={`flex items-center gap-3 border-b border-black/[0.06] px-3 py-2 last:border-0 ${
                      resultIndex === activeIndex ? "bg-black/[0.04]" : ""
                    }`}
                  >
                    <span className="relative flex h-9 w-6 shrink-0 items-center justify-center">
                      <BobbleheadImage
                        src={result.imageUrl || publicAsset(`/bobbleheads/${result.teamSlug}.png`)}
                        alt=""
                        width={30}
                        height={70}
                        unoptimized={isUnoptimizedImage(result.imageUrl)}
                        className="relative h-9 w-auto object-contain"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {result.title}
                        {result.nickname ? (
                          <span className="font-normal text-zinc-600"> “{result.nickname}”</span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-zinc-600">
                        {teamSlug ? result.date : `${result.teamCity} ${result.teamName} · ${result.date}`}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-center text-sm text-zinc-600">No bobbleheads found.</p>
          )}
          {results.length > 0 ? (
            <div className="shrink-0 border-t border-black/[0.06] bg-white p-2">
              <Link
                href={allResultsHref}
                onClick={() => setIsFocused(false)}
                className="block rounded-full bg-accent px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover"
              >
                See All Results →
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
