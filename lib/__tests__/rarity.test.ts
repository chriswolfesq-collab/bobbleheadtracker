import { describe, expect, it } from "vitest";
import { getRarity, parseQuantity } from "@/lib/rarity";

describe("parseQuantity", () => {
  it("parses plain and comma-grouped numbers", () => {
    expect(parseQuantity("40,000")).toBe(40000);
    expect(parseQuantity("7500")).toBe(7500);
  });

  it("uses the lower bound of a range", () => {
    expect(parseQuantity("10,000-15,000")).toBe(10000);
  });

  it("handles approximate prefixes", () => {
    expect(parseQuantity("~15,000")).toBe(15000);
    expect(parseQuantity("First 20,000 fans")).toBe(20000);
  });

  it("returns null for missing or non-numeric values", () => {
    expect(parseQuantity(undefined)).toBeNull();
    expect(parseQuantity(null)).toBeNull();
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("Unknown")).toBeNull();
  });
});

describe("getRarity", () => {
  it("maps quantities to tiers", () => {
    expect(getRarity("5,000")?.tier).toBe("ultra-rare");
    expect(getRarity("9,999")?.tier).toBe("ultra-rare");
    expect(getRarity("10,000")?.tier).toBe("rare");
    expect(getRarity("14,999")?.tier).toBe("rare");
    expect(getRarity("15,000")?.tier).toBe("limited");
    expect(getRarity("24,999")?.tier).toBe("limited");
  });

  it("gives common runs no badge", () => {
    expect(getRarity("25,000")).toBeNull();
    expect(getRarity("40,000")).toBeNull();
  });

  it("gives unknown quantities no badge", () => {
    expect(getRarity("Unknown")).toBeNull();
    expect(getRarity(null)).toBeNull();
  });

  it("states the reason", () => {
    expect(getRarity("7500")?.reason).toBe("Only 7,500 were issued");
  });
});
