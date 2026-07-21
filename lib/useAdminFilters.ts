import { useCallback, useMemo, useState } from "react";

/**
 * One dropdown filter for an admin queue: a dimension of the row (via `get`)
 * that the admin can narrow to a single value. The empty string is the
 * "show everything" default and is never an option value.
 */
export type AdminFilter<T> = {
  /** Stable id, used as the select key and the state key. */
  id: string;
  /** Label for the default "all" option, e.g. "All types". */
  allLabel: string;
  /** The row's value along this dimension. Compared for equality. */
  get: (row: T) => string;
  /** Selectable values with human labels. */
  options: { value: string; label: string }[];
};

export type AdminFiltersState<T> = {
  query: string;
  setQuery: (value: string) => void;
  /** Selected value per filter id; missing/empty means "all". */
  selected: Record<string, string>;
  setFilter: (id: string, value: string) => void;
  /** Rows passing the search text and every active filter, in input order. */
  filtered: T[];
  /** How many of search + filters are currently narrowing the list. */
  activeCount: number;
  /** Clear the search box and every filter. */
  reset: () => void;
};

/**
 * Pure in-memory filtering shared by every admin queue: a case-insensitive
 * substring match of `searchable(row)` against the search box, plus equality
 * on each active dropdown (an empty/missing selection means "all"). Kept free
 * of React so the matching rules can be unit-tested directly.
 */
export function filterAdminRows<T>(
  rows: T[],
  searchable: (row: T) => string,
  filters: AdminFilter<T>[],
  query: string,
  selected: Record<string, string>,
): T[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (needle && !searchable(row).toLowerCase().includes(needle)) return false;
    return filters.every((filter) => {
      const value = selected[filter.id];
      return !value || filter.get(row) === value;
    });
  });
}

/** How many of the search box + dropdowns are currently narrowing the list. */
export function countActiveAdminFilters<T>(
  filters: AdminFilter<T>[],
  query: string,
  selected: Record<string, string>,
): number {
  return (query.trim() ? 1 : 0) + filters.filter((filter) => selected[filter.id]).length;
}

/**
 * Client-side search + dropdown filtering for the admin review queues. The
 * rows are already fully loaded, so this filters in memory via
 * {@link filterAdminRows}. Shared by every admin queue so the behaviour — and
 * the "nothing matches" edge cases — stay identical.
 */
export function useAdminFilters<T>(
  rows: T[],
  searchable: (row: T) => string,
  filters: AdminFilter<T>[],
  initial?: { query?: string; selected?: Record<string, string> },
): AdminFiltersState<T> {
  const [query, setQuery] = useState(initial?.query ?? "");
  const [selected, setSelected] = useState<Record<string, string>>(initial?.selected ?? {});

  const setFilter = useCallback((id: string, value: string) => {
    setSelected((prev) => ({ ...prev, [id]: value }));
  }, []);

  const reset = useCallback(() => {
    setQuery("");
    setSelected({});
  }, []);

  const filtered = useMemo(
    () => filterAdminRows(rows, searchable, filters, query, selected),
    [rows, searchable, filters, query, selected],
  );

  const activeCount = countActiveAdminFilters(filters, query, selected);

  return { query, setQuery, selected, setFilter, filtered, activeCount, reset };
}
