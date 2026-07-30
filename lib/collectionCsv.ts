import { type Condition, isCondition, parsePricePaid } from "@/lib/collectionDetails";

// Reading and writing a collection as CSV, so a shelf that took years to tick
// off isn't trapped in one database. Pure string work — the queries and the
// download live in components/CollectionTransfer.tsx.
//
// The file is meant to survive a round trip through a spreadsheet, which is
// where most people will actually edit it. That drives most of what's here:
// tolerant headers, several spellings of yes/no, prices with a currency symbol
// still attached, and the formula guard below.

export type CollectionCsvRow = {
  teamSlug: string;
  bobbleheadId: string;
  owned: boolean;
  wanted: boolean;
  favorite: boolean;
  condition: Condition | null;
  acquiredOn: string | null;
  pricePaid: number | null;
  notes: string | null;
};

// What export writes on top of the flags: the listing's identity in a form a
// person can read. Import ignores these columns — a title that's been edited on
// the site since the file was written shouldn't stop the row from matching.
export type CollectionCsvExportRow = CollectionCsvRow & {
  team: string;
  title: string;
  year: string;
  date: string;
};

export const COLLECTION_CSV_HEADERS = [
  "team_slug",
  "bobblehead_id",
  "team",
  "title",
  "year",
  "date",
  "owned",
  "wanted",
  "favorite",
  "condition",
  "acquired_on",
  "price_paid",
  "notes",
] as const;

const CONDITION_CSV_LABELS: Record<Condition, string> = {
  in_box: "In box",
  out_of_box: "Out of box",
};

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

// Excel and Sheets treat a cell opening with any of these as a formula, so a
// note someone typed can become a live expression in whoever opens the file.
// Quoting doesn't stop it — an apostrophe does, and it's stripped again on the
// way back in so the round trip is lossless.
const FORMULA_LEAD = /^[=+\-@]/;

function escapeField(value: string): string {
  const guarded = FORMULA_LEAD.test(value) ? `'${value}` : value;
  // Leading/trailing spaces are quoted too, so they survive the readers that
  // would otherwise trim them.
  return /[",\r\n]|^\s|\s$/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

function unescapeFormulaGuard(value: string): string {
  return value.startsWith("'") && FORMULA_LEAD.test(value.slice(1)) ? value.slice(1) : value;
}

export function toCollectionCsv(rows: CollectionCsvExportRow[]): string {
  const lines = [COLLECTION_CSV_HEADERS.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.teamSlug,
        row.bobbleheadId,
        row.team,
        row.title,
        row.year,
        row.date,
        row.owned ? "yes" : "no",
        row.wanted ? "yes" : "no",
        row.favorite ? "yes" : "no",
        row.condition ? CONDITION_CSV_LABELS[row.condition] : "",
        row.acquiredOn ?? "",
        // Unformatted, so the column arrives in a spreadsheet as a number
        // rather than as text that happens to look like money.
        row.pricePaid === null ? "" : row.pricePaid.toFixed(2),
        row.notes ?? "",
      ]
        .map((field) => escapeField(String(field)))
        .join(","),
    );
  }

  // Trailing newline: some readers drop the last row without it.
  return `${lines.join("\r\n")}\r\n`;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

// A hand-rolled reader rather than a dependency, because the format's whole
// surface is three rules: fields split on commas, a quoted field may contain
// commas and newlines, and "" inside a quoted field is a literal quote.
export function parseCsvRows(text: string): string[][] {
  // A BOM from Excel would otherwise become part of the first header's name.
  const input = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < input.length) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      endField();
      index += 1;
      continue;
    }
    if (char === "\r") {
      // Bare \r is a line break too — old Mac exports still turn up.
      endRow();
      index += input[index + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (char === "\n") {
      endRow();
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  // Whatever is in hand at EOF is a final row, unless the file simply ended
  // with a newline and there's nothing pending.
  if (field !== "" || row.length > 0) endRow();

  return rows.filter((entry) => !(entry.length === 1 && entry[0].trim() === ""));
}

// "Price Paid", "price_paid" and "price paid" are the same column.
function normalizeHeader(name: string): string {
  return name.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function parseFlag(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (value === "") return null;
  if (["yes", "y", "true", "t", "1", "x"].includes(value)) return true;
  if (["no", "n", "false", "f", "0"].includes(value)) return false;
  return null;
}

function parseCondition(raw: string): Condition | null {
  const value = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return isCondition(value) ? value : null;
}

// Rejects both "2024-13-01" and "2024-02-31": round-tripping through Date
// catches the month that doesn't exist and the day that overflows into March.
function parseAcquiredOn(raw: string): { value: string | null } | { error: string } {
  const value = raw.trim();
  if (!value) return { value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { error: `acquired_on "${value}" isn't a yyyy-mm-dd date` };
  }

  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const asDate = new Date(year, month - 1, day);
  if (
    asDate.getFullYear() !== year ||
    asDate.getMonth() !== month - 1 ||
    asDate.getDate() !== day
  ) {
    return { error: `acquired_on "${value}" isn't a real date` };
  }

  return { value };
}

export type CollectionCsvProblem = { line: number; message: string };

export type ParsedCollectionCsv = {
  rows: CollectionCsvRow[];
  /** One per line that couldn't be used, with its 1-based line number. */
  problems: CollectionCsvProblem[];
};

// Returns `{ error }` only when the file as a whole is unusable. A single bad
// line is a problem, not a failure: importing 400 good rows and being told
// about the 3 that were wrong beats being told to fix the file and try again.
export function parseCollectionCsv(text: string): ParsedCollectionCsv | { error: string } {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { error: "That file is empty." };

  const headers = rows[0].map(normalizeHeader);
  const columnOf = (name: string) => headers.indexOf(name);

  const teamSlugAt = columnOf("team_slug");
  const bobbleheadIdAt = columnOf("bobblehead_id");
  if (teamSlugAt === -1 || bobbleheadIdAt === -1) {
    return {
      error: "That file needs team_slug and bobblehead_id columns. Export yours to see the shape.",
    };
  }

  const ownedAt = columnOf("owned");
  const wantedAt = columnOf("wanted");
  const favoriteAt = columnOf("favorite");
  const conditionAt = columnOf("condition");
  const acquiredAt = columnOf("acquired_on");
  const priceAt = columnOf("price_paid");
  const notesAt = columnOf("notes");

  const at = (row: string[], index: number) => (index === -1 ? "" : (row[index] ?? ""));

  const parsed: CollectionCsvRow[] = [];
  const problems: CollectionCsvProblem[] = [];
  const seen = new Set<string>();

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const line = index + 1;

    const teamSlug = at(row, teamSlugAt).trim();
    const bobbleheadId = at(row, bobbleheadIdAt).trim();
    if (!teamSlug || !bobbleheadId) {
      problems.push({ line, message: "missing team_slug or bobblehead_id" });
      continue;
    }

    // A duplicate would otherwise be two upserts racing to write the same row,
    // with whichever lands last silently winning.
    const key = `${teamSlug}:${bobbleheadId}`;
    if (seen.has(key)) {
      problems.push({ line, message: `${bobbleheadId} appears more than once` });
      continue;
    }

    const acquiredOn = parseAcquiredOn(at(row, acquiredAt));
    if ("error" in acquiredOn) {
      problems.push({ line, message: acquiredOn.error });
      continue;
    }

    const pricePaid = parsePricePaid(unescapeFormulaGuard(at(row, priceAt)));
    if ("error" in pricePaid) {
      problems.push({ line, message: `price_paid — ${pricePaid.error}` });
      continue;
    }

    const notes = unescapeFormulaGuard(at(row, notesAt)).trim();

    seen.add(key);
    parsed.push({
      teamSlug,
      bobbleheadId,
      // A blank flag column means "not on that list" rather than "leave it
      // alone": the file is a snapshot of a collection, so importing it should
      // reproduce that collection, including what isn't in it.
      owned: parseFlag(at(row, ownedAt)) ?? false,
      wanted: parseFlag(at(row, wantedAt)) ?? false,
      favorite: parseFlag(at(row, favoriteAt)) ?? false,
      condition: parseCondition(at(row, conditionAt)),
      acquiredOn: acquiredOn.value,
      pricePaid: pricePaid.value,
      notes: notes || null,
    });
  }

  return { rows: parsed, problems };
}
