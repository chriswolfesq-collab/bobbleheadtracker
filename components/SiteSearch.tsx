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
}: { teamSlug?: string; buttonLabel?: string; variant?: "centered" | "inline" } = {}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const index = useSearchIndex(teamSlug);

  const results = useMemo(() => searchGiveaways(index, query), [index, query]);
  const showResults = isFocused && query.trim().length > 0;
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
          className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-5 py-2.5 text-sm font-semibold text-zinc-900 backdrop-blur transition hover:border-accent hover:text-accent-hover dark:border-white/15 dark:bg-[#101827]/70 dark:text-white dark:hover:text-accent-hover"
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
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 dark:text-zinc-400"
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
          className="w-full rounded-full border border-black/10 bg-white/70 py-2.5 pl-10 pr-9 text-sm text-zinc-900 outline-none backdrop-blur transition placeholder:text-zinc-500 focus:border-accent dark:border-white/15 dark:bg-[#101827]/70 dark:text-white [&::-webkit-search-cancel-button]:appearance-none"
        />
        <button
          type="button"
          onClick={closeSearch}
          aria-label="Close search"
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 transition hover:text-accent-hover dark:text-zinc-400 dark:hover:text-accent-hover"
        >
          ✕
        </button>
      </div>

      {showResults ? (
        <div className="absolute left-4 right-4 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-lg border border-black/10 bg-white shadow-2xl dark:border-white/15 dark:bg-[#0b1626] sm:left-0 sm:right-0">
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
                    className={`flex items-center gap-3 border-b border-black/[0.06] px-3 py-2 last:border-0 dark:border-white/5 ${
                      resultIndex === activeIndex ? "bg-black/[0.04] dark:bg-white/5" : ""
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
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                        {result.title}
                        {result.nickname ? (
                          <span className="font-normal text-zinc-600 dark:text-zinc-400"> “{result.nickname}”</span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                        {teamSlug ? result.date : `${result.teamCity} ${result.teamName} · ${result.date}`}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">No bobbleheads found.</p>
          )}
          {results.length > 0 ? (
            <Link
              href={allResultsHref}
              onClick={() => setIsFocused(false)}
              className="block border-t border-black/[0.06] px-3 py-2.5 text-center text-xs font-black uppercase tracking-wide text-accent transition hover:bg-black/[0.04] dark:border-white/5 dark:hover:bg-white/5"
            >
              View all results →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
