import { useCallback, useMemo, useState } from "react";

export type BulkSelection = {
  /** Currently-selected ids that still exist in the list, in list order. */
  selectedIds: string[];
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Select every current id, or clear if they're already all selected. */
  toggleAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  clear: () => void;
};

/**
 * Tracks a set of selected row ids for the admin review queues. `currentIds`
 * is the ids visible right now; selections for ids that have been removed
 * (e.g. after a bulk action drops those rows) are ignored, so callers don't
 * have to prune the set themselves.
 */
export function useBulkSelection(currentIds: string[]): BulkSelection {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const selectedIds = useMemo(
    () => currentIds.filter((id) => selected.has(id)),
    [currentIds, selected],
  );

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const everySelected = currentIds.length > 0 && currentIds.every((id) => prev.has(id));
      return everySelected ? new Set<string>() : new Set(currentIds);
    });
  }, [currentIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const count = selectedIds.length;

  return {
    selectedIds,
    count,
    isSelected,
    toggle,
    toggleAll,
    allSelected: currentIds.length > 0 && count === currentIds.length,
    someSelected: count > 0,
    clear,
  };
}
