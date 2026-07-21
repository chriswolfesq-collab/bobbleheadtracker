"use client";

import { useEffect, useRef, type ReactNode } from "react";

type BulkSelectBarProps = {
  total: number;
  count: number;
  allSelected: boolean;
  onToggleAll: () => void;
  busy: boolean;
  /** Non-null while a bulk action is running, for the "3/10…" progress hint. */
  progress: { done: number; total: number } | null;
  /** Bulk action buttons for this queue. */
  children: ReactNode;
};

/**
 * Sticky toolbar shown above an admin review queue: a select-all checkbox, a
 * live selected count, and the queue's bulk action buttons. Shared by all four
 * review pages so the selection UI stays identical.
 */
export function BulkSelectBar({
  total,
  count,
  allSelected,
  onToggleAll,
  busy,
  progress,
  children,
}: BulkSelectBarProps) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  // Show the "partial" tick when some — but not all — rows are selected.
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = count > 0 && !allSelected;
    }
  }, [count, allSelected]);

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 bg-slate-50/95 px-4 py-3 backdrop-blur dark:bg-[#15110d]/95 sm:-mx-8 sm:px-8">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#0b1a29]">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            disabled={busy || total === 0}
            className="h-4 w-4 accent-accent"
            aria-label="Select all"
          />
          Select all
        </label>
        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          {count} of {total} selected
        </span>
        <div className="ml-auto flex items-center gap-2">
          {busy && progress ? (
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400" role="status">
              {progress.done}/{progress.total}…
            </span>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}

const BASE_BUTTON =
  "rounded px-3 py-1.5 text-xs font-black uppercase tracking-wide transition disabled:opacity-40 disabled:pointer-events-none";

/** Amber primary bulk button (approve / resolve / mark fixed). */
export function BulkPrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BASE_BUTTON} bg-accent text-accent-fg hover:bg-accent-hover`}
    >
      {children}
    </button>
  );
}

/** Bordered secondary bulk button (reject / dismiss). */
export function BulkSecondaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BASE_BUTTON} border border-black/15 text-zinc-800 hover:border-red-400 hover:text-red-300 dark:border-white/20 dark:text-zinc-200`}
    >
      {children}
    </button>
  );
}
