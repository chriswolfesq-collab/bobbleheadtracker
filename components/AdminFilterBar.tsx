"use client";

import type { AdminFilter, AdminFiltersState } from "@/lib/useAdminFilters";

type AdminFilterBarProps<T> = {
  /** The dropdown filters to render, left to right after the search box. */
  filters: AdminFilter<T>[];
  /** State returned by useAdminFilters. */
  state: AdminFiltersState<T>;
  /** Search box placeholder, e.g. "Search submissions…". */
  placeholder: string;
  /** Total rows before filtering, for the "X of Y" hint. */
  total: number;
  /** Plural noun for the rows, e.g. "submissions". */
  noun: string;
};

/**
 * Search box + dropdown filters shown above an admin review queue. Pairs with
 * useAdminFilters, which owns the state and the filtering; this only renders
 * the controls and a live result count. Shared by every admin queue so the
 * search/filter UI stays identical.
 */
export function AdminFilterBar<T>({
  filters,
  state,
  placeholder,
  total,
  noun,
}: AdminFilterBarProps<T>) {
  const shown = state.filtered.length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#0b1a29]">
        <input
          type="search"
          value={state.query}
          onChange={(event) => state.setQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-[12rem] flex-1 rounded border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-accent dark:border-white/15 dark:bg-[#07111d] dark:text-white"
        />
        {filters.map((filter) => (
          <select
            key={filter.id}
            value={state.selected[filter.id] ?? ""}
            onChange={(event) => state.setFilter(filter.id, event.target.value)}
            aria-label={filter.allLabel}
            className="rounded border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none focus:border-accent dark:border-white/15 dark:bg-[#07111d] dark:text-white"
          >
            <option value="">{filter.allLabel}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
        {state.activeCount > 0 ? (
          <button
            type="button"
            onClick={state.reset}
            className="rounded border border-black/15 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover dark:border-white/20 dark:text-zinc-200 dark:hover:text-accent-hover"
          >
            Clear
          </button>
        ) : null}
      </div>
      <p className="mt-2 px-1 text-xs text-zinc-500">
        Showing {shown} of {total} {noun}
      </p>
    </div>
  );
}
