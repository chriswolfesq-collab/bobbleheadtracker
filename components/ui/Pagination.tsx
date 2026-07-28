"use client";

/* Numbered pagination with an ellipsis window: 1 … 4 [5] 6 … 13. */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  const navButton =
    "rounded border border-border-soft bg-surface px-3 py-1.5 text-sm font-semibold text-navy transition hover:border-accent disabled:pointer-events-none disabled:opacity-40";

  return (
    <nav aria-label="Pagination" className={`flex items-center justify-center gap-1.5 ${className ?? ""}`}>
      <button
        type="button"
        className={navButton}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <span aria-hidden>‹</span> Prev
      </button>
      {pageWindow(page, pageCount).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-zinc-500" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPageChange(p)}
            className={`h-9 min-w-9 rounded px-2 text-sm font-semibold transition ${
              p === page
                ? "bg-accent text-accent-fg"
                : "border border-border-soft bg-surface text-navy hover:border-accent"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className={navButton}
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next <span aria-hidden>›</span>
      </button>
    </nav>
  );
}
