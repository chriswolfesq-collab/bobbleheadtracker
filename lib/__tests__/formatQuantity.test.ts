import { describe, expect, it } from "vitest";
import { formatQuantity } from "@/lib/formatQuantity";

describe("formatQuantity", () => {
  it("adds a comma to a bare thousands number", () => {
    expect(formatQuantity("40000")).toBe("40,000");
    expect(formatQuantity("1000")).toBe("1,000");
    expect(formatQuantity("1500000")).toBe("1,500,000");
  });

  it("leaves numbers under 1,000 alone", () => {
    expect(formatQuantity("350")).toBe("350");
    expect(formatQuantity("0")).toBe("0");
  });

  it("is idempotent on already-grouped values", () => {
    expect(formatQuantity("40,000")).toBe("40,000");
    expect(formatQuantity("1,500,000")).toBe("1,500,000");
  });

  it("keeps a leading prefix and formats the number", () => {
    expect(formatQuantity("~15000")).toBe("~15,000");
  });

  it("formats each number in a range", () => {
    expect(formatQuantity("10000-15000")).toBe("10,000-15,000");
  });

  it("leaves non-numeric text untouched", () => {
    expect(formatQuantity("Unknown")).toBe("Unknown");
    expect(formatQuantity("")).toBe("");
    expect(formatQuantity("TBD")).toBe("TBD");
  });

  it("normalizes a misgrouped number", () => {
    expect(formatQuantity("4,0000")).toBe("40,000");
  });
});
