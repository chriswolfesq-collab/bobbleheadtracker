import { describe, expect, it } from "vitest";
import {
  COLLECTION_CSV_HEADERS,
  type CollectionCsvExportRow,
  parseCollectionCsv,
  parseCsvRows,
  toCollectionCsv,
} from "@/lib/collectionCsv";

const exportRow = (over: Partial<CollectionCsvExportRow> = {}): CollectionCsvExportRow => ({
  teamSlug: "athletics",
  bobbleheadId: "vida-blue-2024",
  team: "Oakland Athletics",
  title: "Vida Blue",
  year: "2024",
  date: "August 18, 2024",
  owned: true,
  wanted: false,
  favorite: false,
  condition: null,
  acquiredOn: null,
  pricePaid: null,
  notes: null,
  ...over,
});

// Everything here is really one question asked repeatedly: does a collection
// survive the round trip out to a spreadsheet and back?
function roundTrip(rows: CollectionCsvExportRow[]) {
  const parsed = parseCollectionCsv(toCollectionCsv(rows));
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed;
}

describe("parseCsvRows", () => {
  it("splits plain rows", () => {
    expect(parseCsvRows("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps commas and newlines inside quotes", () => {
    expect(parseCsvRows('a,b\n"one, two","line\nbreak"\n')).toEqual([
      ["a", "b"],
      ["one, two", "line\nbreak"],
    ]);
  });

  it("reads a doubled quote as one literal quote", () => {
    expect(parseCsvRows('a\n"say ""hi"""\n')).toEqual([["a"], ['say "hi"']]);
  });

  it("handles CRLF, a bare CR, and a missing final newline", () => {
    expect(parseCsvRows("a,b\r\n1,2\r\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
    expect(parseCsvRows("a\r1")).toEqual([["a"], ["1"]]);
  });

  it("strips the BOM Excel writes", () => {
    expect(parseCsvRows("﻿team_slug,x\n")).toEqual([["team_slug", "x"]]);
  });

  it("drops blank lines rather than reading them as rows", () => {
    expect(parseCsvRows("a\n\n1\n")).toEqual([["a"], ["1"]]);
  });
});

describe("toCollectionCsv", () => {
  it("leads with the documented header row", () => {
    expect(toCollectionCsv([]).trim()).toBe(COLLECTION_CSV_HEADERS.join(","));
  });

  it("writes flags as yes/no and prices with cents", () => {
    const csv = toCollectionCsv([exportRow({ wanted: true, pricePaid: 12.5 })]);
    expect(csv).toContain("yes,yes,no,");
    expect(csv).toContain(",12.50,");
  });

  // A note reading "=cmd|..." is a live formula to Excel the moment the file
  // opens, so it leaves here defused — and comes back undefused.
  it("defuses a note that would be read as a formula", () => {
    const csv = toCollectionCsv([exportRow({ notes: "=1+1" })]);
    expect(csv).toContain("'=1+1");

    const parsed = roundTrip([exportRow({ notes: "=1+1" })]);
    expect(parsed.rows[0].notes).toBe("=1+1");
  });

  it("quotes a note containing a comma, a quote or a newline", () => {
    const parsed = roundTrip([exportRow({ notes: 'box is "creased", one corner\nand a dent' })]);
    expect(parsed.rows[0].notes).toBe('box is "creased", one corner\nand a dent');
  });
});

describe("round trip", () => {
  it("brings back every field it took", () => {
    const parsed = roundTrip([
      exportRow({
        owned: true,
        wanted: true,
        favorite: true,
        condition: "out_of_box",
        acquiredOn: "2019-07-04",
        pricePaid: 1250.75,
        notes: "yard sale",
      }),
    ]);

    expect(parsed.problems).toEqual([]);
    expect(parsed.rows).toEqual([
      {
        teamSlug: "athletics",
        bobbleheadId: "vida-blue-2024",
        owned: true,
        wanted: true,
        favorite: true,
        condition: "out_of_box",
        acquiredOn: "2019-07-04",
        pricePaid: 1250.75,
        notes: "yard sale",
      },
    ]);
  });

  // Free at the gate has to stay $0.00 and not become "no price recorded".
  it("keeps a recorded zero distinct from a blank", () => {
    const parsed = roundTrip([
      exportRow({ bobbleheadId: "a", pricePaid: 0 }),
      exportRow({ bobbleheadId: "b", pricePaid: null }),
    ]);
    expect(parsed.rows.map((row) => row.pricePaid)).toEqual([0, null]);
  });

  it("keeps a wanted-but-not-owned listing", () => {
    const parsed = roundTrip([exportRow({ owned: false, wanted: true })]);
    expect(parsed.rows[0]).toMatchObject({ owned: false, wanted: true });
  });
});

describe("parseCollectionCsv", () => {
  it("rejects a file without the two columns it matches on", () => {
    expect(parseCollectionCsv("title,owned\nVida Blue,yes\n")).toEqual({
      error: expect.stringContaining("team_slug and bobblehead_id"),
    });
  });

  it("rejects an empty file", () => {
    expect(parseCollectionCsv("")).toEqual({ error: "That file is empty." });
  });

  it("accepts headers however a spreadsheet spelled them", () => {
    const parsed = parseCollectionCsv(
      "Team Slug,Bobblehead ID,Owned,Price Paid\nathletics,vida-blue-2024,YES,$40\n",
    );
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.rows[0]).toMatchObject({
      teamSlug: "athletics",
      bobbleheadId: "vida-blue-2024",
      owned: true,
      pricePaid: 40,
    });
  });

  it("reads the condition label a person would type", () => {
    const parsed = parseCollectionCsv(
      "team_slug,bobblehead_id,condition\n" +
        "athletics,a,In box\n" +
        "athletics,b,out_of_box\n" +
        "athletics,c,mint\n",
    );
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.rows.map((row) => row.condition)).toEqual(["in_box", "out_of_box", null]);
  });

  // One wrong line shouldn't cost someone the other four hundred.
  it("keeps the good rows and reports the bad ones by line", () => {
    const parsed = parseCollectionCsv(
      "team_slug,bobblehead_id,acquired_on,price_paid\n" +
        "athletics,good,2024-03-04,10\n" +
        "athletics,bad-date,2024-02-31,10\n" +
        ",no-team,,\n" +
        "athletics,bad-price,,free\n",
    );
    if ("error" in parsed) throw new Error(parsed.error);

    expect(parsed.rows.map((row) => row.bobbleheadId)).toEqual(["good"]);
    expect(parsed.problems).toEqual([
      { line: 3, message: expect.stringContaining("isn't a real date") },
      { line: 4, message: "missing team_slug or bobblehead_id" },
      { line: 5, message: expect.stringContaining("price_paid") },
    ]);
  });

  it("refuses a month that doesn't exist", () => {
    const parsed = parseCollectionCsv("team_slug,bobblehead_id,acquired_on\nathletics,a,2024-13-01\n");
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.rows).toEqual([]);
    expect(parsed.problems[0].message).toContain("2024-13-01");
  });

  // Two rows for one listing would be two upserts racing, with the loser's
  // values silently discarded.
  it("takes the first of a duplicated listing and flags the rest", () => {
    const parsed = parseCollectionCsv(
      "team_slug,bobblehead_id,owned\nathletics,a,yes\nathletics,a,no\n",
    );
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].owned).toBe(true);
    expect(parsed.problems[0]).toEqual({ line: 3, message: "a appears more than once" });
  });

  it("treats a blank flag as not on that list", () => {
    const parsed = parseCollectionCsv("team_slug,bobblehead_id,owned,wanted\nathletics,a,,\n");
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.rows[0]).toMatchObject({ owned: false, wanted: false, favorite: false });
  });

  it("tolerates a short row that stops before the last columns", () => {
    const parsed = parseCollectionCsv("team_slug,bobblehead_id,owned,notes\nathletics,a\n");
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.rows[0]).toMatchObject({ bobbleheadId: "a", owned: false, notes: null });
  });
});
