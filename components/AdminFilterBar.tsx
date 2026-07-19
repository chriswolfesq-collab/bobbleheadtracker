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
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-[#0b1a29] px-4 py-3">
        <input
          type="search"
          value={state.query}
          onChange={(event) => state.setQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-[12rem] flex-1 rounded border border-white/15 bg-[#07111d] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-400"
        />
        {filters.map((filter) => (
          <select
            key={filter.id}
            value={state.selected[filter.id] ?? ""}
            onChange={(event) => state.setFilter(filter.id, event.target.value)}
            aria-label={filter.allLabel}
            className="rounded border border-white/15 bg-[#07111d] px-3 py-2 text-sm font-semibold text-white outline-none focus:border-amber-400"
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
            className="rounded border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
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
