// The per-item record behind an owned bobblehead: which of the two conditions
// it's in, when it was acquired, what it cost, and anything else worth
// remembering. These are columns on the user_collections row rather than a
// table of their own — see supabase/collection_details.sql.
//
// Every field is optional and independently so. Someone who only ever records
// "still in the box" should never be asked for a price, and a blank field means
// "not recorded", never zero or today.
//
// Shape and formatting only; the reads and writes live in
// lib/useCollectionDetail.ts.

export const CONDITIONS = ["in_box", "out_of_box"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  in_box: "In box",
  out_of_box: "Out of box",
};

export type CollectionDetail = {
  condition: Condition | null;
  /** ISO `yyyy-mm-dd`, matching the `date` column and `<input type="date">`. */
  acquiredOn: string | null;
  pricePaid: number | null;
  notes: string | null;
};

export const EMPTY_DETAIL: CollectionDetail = {
  condition: null,
  acquiredOn: null,
  pricePaid: null,
  notes: null,
};

export function isCondition(value: unknown): value is Condition {
  return (CONDITIONS as readonly unknown[]).includes(value);
}

export function hasAnyDetail(detail: CollectionDetail): boolean {
  return (
    detail.condition !== null ||
    detail.acquiredOn !== null ||
    detail.pricePaid !== null ||
    (detail.notes?.trim().length ?? 0) > 0
  );
}

// Split on the string rather than going through Date. `new Date("2024-03-04")`
// is parsed as UTC midnight, which formats as March 3 for anyone west of
// Greenwich — the date someone typed would come back a day earlier than they
// typed it. A `date` column has no time and no zone, so neither should this.
export function formatAcquiredOn(iso: string | null): string | null {
  if (!iso) return null;
  const parts = iso.split("-");
  if (parts.length !== 3) return null;

  const [year, month, day] = parts.map((part) => Number.parseInt(part, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatPricePaid(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Free-typed price text -> what the numeric(10,2) column will accept, or an
// error to show instead. Strips the currency symbol, spaces and thousands
// separators people paste in from a receipt.
export function parsePricePaid(raw: string): { value: number | null } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };

  const cleaned = trimmed.replace(/[$\s,]/g, "");
  // A negative is a typo with an obvious cause, so it gets its own sentence
  // rather than being lumped in with "not a number" below.
  if (cleaned.startsWith("-")) return { error: "A price can't be negative." };
  // Number("") is 0 and Number("0x10") is 16, so an all-punctuation entry has
  // to be rejected on shape before it's parsed.
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === "." || cleaned === "") {
    return { error: "That price isn't a number." };
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return { error: "That price isn't a number." };
  // 10 total digits, 2 of them decimal — the column's own ceiling, caught here
  // so the failure reads as a sentence instead of a Postgres overflow.
  if (parsed >= 100_000_000) return { error: "That price is too large." };

  return { value: Math.round(parsed * 100) / 100 };
}
