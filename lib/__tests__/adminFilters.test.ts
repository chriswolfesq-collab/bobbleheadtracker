import { describe, expect, it } from "vitest";
import {
  type AdminFilter,
  countActiveAdminFilters,
  filterAdminRows,
} from "@/lib/useAdminFilters";

type Row = { id: string; team: string; title: string; kind: string };

const rows: Row[] = [
  { id: "1", team: "dodgers", title: "Shohei Ohtani", kind: "new_bobblehead" },
  { id: "2", team: "yankees", title: "Aaron Judge", kind: "photo_for_existing" },
  { id: "3", team: "dodgers", title: "Mookie Betts", kind: "photo_for_existing" },
];

const searchable = (row: Row) => `${row.team} ${row.title}`;

const FILTERS: AdminFilter<Row>[] = [
  {
    id: "kind",
    allLabel: "All types",
    get: (row) => row.kind,
    options: [
      { value: "new_bobblehead", label: "New" },
      { value: "photo_for_existing", label: "Photo" },
    ],
  },
];

const ids = (result: Row[]) => result.map((row) => row.id);

describe("filterAdminRows", () => {
  it("returns every row when nothing is narrowing the list", () => {
    expect(ids(filterAdminRows(rows, searchable, FILTERS, "", {}))).toEqual(["1", "2", "3"]);
  });

  it("matches the search text case-insensitively across searchable fields", () => {
    expect(ids(filterAdminRows(rows, searchable, FILTERS, "MOOKIE", {}))).toEqual(["3"]);
    expect(ids(filterAdminRows(rows, searchable, FILTERS, "dodgers", {}))).toEqual(["1", "3"]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(ids(filterAdminRows(rows, searchable, FILTERS, "  judge  ", {}))).toEqual(["2"]);
  });

  it("filters by an active dropdown value", () => {
    expect(ids(filterAdminRows(rows, searchable, FILTERS, "", { kind: "photo_for_existing" }))).toEqual([
      "2",
      "3",
    ]);
  });

  it("treats an empty dropdown value as 'all'", () => {
    expect(ids(filterAdminRows(rows, searchable, FILTERS, "", { kind: "" }))).toEqual(["1", "2", "3"]);
  });

  it("combines the search text with the dropdown (AND, not OR)", () => {
    expect(
      ids(filterAdminRows(rows, searchable, FILTERS, "dodgers", { kind: "photo_for_existing" })),
    ).toEqual(["3"]);
  });

  it("returns nothing when the filters exclude every row", () => {
    expect(filterAdminRows(rows, searchable, FILTERS, "no-such-team", {})).toEqual([]);
  });
});

describe("countActiveAdminFilters", () => {
  it("counts nothing when the query is blank and no dropdown is set", () => {
    expect(countActiveAdminFilters(FILTERS, "   ", { kind: "" })).toBe(0);
  });

  it("counts the search box and each set dropdown", () => {
    expect(countActiveAdminFilters(FILTERS, "judge", {})).toBe(1);
    expect(countActiveAdminFilters(FILTERS, "judge", { kind: "new_bobblehead" })).toBe(2);
  });
});
