import { describe, expect, it } from "vitest";
import {
  EMPTY_DETAIL,
  formatAcquiredOn,
  formatPricePaid,
  hasAnyDetail,
  isCondition,
  parsePricePaid,
} from "@/lib/collectionDetails";

describe("formatAcquiredOn", () => {
  // The bug this guards: `new Date("2024-03-04")` is UTC midnight, which is
  // March 3 anywhere west of Greenwich. A date column has no zone, so the day
  // that comes back has to be the day that was typed.
  it("keeps the day that was stored", () => {
    expect(formatAcquiredOn("2024-03-04")).toBe("March 4, 2024");
  });

  it("handles the first of January", () => {
    expect(formatAcquiredOn("2019-01-01")).toBe("January 1, 2019");
  });

  it("returns null for nothing recorded", () => {
    expect(formatAcquiredOn(null)).toBeNull();
  });

  it("returns null rather than an Invalid Date for junk", () => {
    expect(formatAcquiredOn("not-a-date")).toBeNull();
    expect(formatAcquiredOn("2024-03")).toBeNull();
  });
});

describe("formatPricePaid", () => {
  it("always shows cents", () => {
    expect(formatPricePaid(12)).toBe("$12.00");
    expect(formatPricePaid(12.5)).toBe("$12.50");
  });

  // Free at the gate is a real answer, and has to survive as one.
  it("formats zero rather than treating it as absent", () => {
    expect(formatPricePaid(0)).toBe("$0.00");
  });

  it("returns null for nothing recorded", () => {
    expect(formatPricePaid(null)).toBeNull();
  });
});

describe("parsePricePaid", () => {
  it("reads a plain number", () => {
    expect(parsePricePaid("40")).toEqual({ value: 40 });
  });

  it("strips what people paste in from a receipt", () => {
    expect(parsePricePaid(" $1,250.75 ")).toEqual({ value: 1250.75 });
  });

  it("treats an empty field as not recorded", () => {
    expect(parsePricePaid("")).toEqual({ value: null });
    expect(parsePricePaid("   ")).toEqual({ value: null });
  });

  it("keeps zero as zero", () => {
    expect(parsePricePaid("0")).toEqual({ value: 0 });
  });

  it("rounds to the two decimals the column stores", () => {
    expect(parsePricePaid("10.999")).toEqual({ value: 11 });
  });

  it("rejects a negative with its own message", () => {
    expect(parsePricePaid("-5")).toEqual({ error: "A price can't be negative." });
  });

  // Number() would happily turn both of these into something.
  it("rejects text and stray punctuation", () => {
    expect(parsePricePaid("free")).toEqual({ error: "That price isn't a number." });
    expect(parsePricePaid("0x10")).toEqual({ error: "That price isn't a number." });
    expect(parsePricePaid(".")).toEqual({ error: "That price isn't a number." });
  });

  it("rejects what the column couldn't hold", () => {
    expect(parsePricePaid("100000000")).toEqual({ error: "That price is too large." });
  });
});

describe("hasAnyDetail", () => {
  it("is false for a record nobody has filled in", () => {
    expect(hasAnyDetail(EMPTY_DETAIL)).toBe(false);
  });

  it("is true once any one field is set", () => {
    expect(hasAnyDetail({ ...EMPTY_DETAIL, condition: "in_box" })).toBe(true);
    expect(hasAnyDetail({ ...EMPTY_DETAIL, acquiredOn: "2024-03-04" })).toBe(true);
    expect(hasAnyDetail({ ...EMPTY_DETAIL, pricePaid: 0 })).toBe(true);
    expect(hasAnyDetail({ ...EMPTY_DETAIL, notes: "chipped bat" })).toBe(true);
  });

  // Whitespace typed into the notes box isn't a detail.
  it("ignores blank notes", () => {
    expect(hasAnyDetail({ ...EMPTY_DETAIL, notes: "   " })).toBe(false);
  });
});

describe("isCondition", () => {
  it("accepts the two stored values", () => {
    expect(isCondition("in_box")).toBe(true);
    expect(isCondition("out_of_box")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isCondition("mint")).toBe(false);
    expect(isCondition(null)).toBe(false);
  });
});
