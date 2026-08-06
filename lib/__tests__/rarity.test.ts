import { describe, expect, it } from "vitest";
import { getRarity, parseRarityTier } from "@/lib/rarity";

describe("parseRarityTier", () => {
  it("accepts the three known tiers", () => {
    expect(parseRarityTier("ultra-rare")).toBe("ultra-rare");
    expect(parseRarityTier("rare")).toBe("rare");
    expect(parseRarityTier("limited")).toBe("limited");
  });

  it("rejects anything else", () => {
    expect(parseRarityTier(undefined)).toBeNull();
    expect(parseRarityTier(null)).toBeNull();
    expect(parseRarityTier("")).toBeNull();
    expect(parseRarityTier("Ultra Rare")).toBeNull();
    expect(parseRarityTier("legendary")).toBeNull();
  });
});

describe("getRarity", () => {
  it("labels a set tier", () => {
    expect(getRarity("ultra-rare")).toEqual({
      tier: "ultra-rare",
      label: "Ultra Rare",
      note: null,
    });
  });

  it("carries the stated reason", () => {
    expect(getRarity("rare", "Fewer than 200 known to exist")?.note).toBe(
      "Fewer than 200 known to exist",
    );
  });

  it("treats a blank note as no note", () => {
    expect(getRarity("limited", "   ")?.note).toBeNull();
  });

  it("gives an unset listing no badge", () => {
    expect(getRarity(null)).toBeNull();
    expect(getRarity(undefined, "a note without a tier")).toBeNull();
  });

  // The whole point of the change: quantity no longer decides anything, so a
  // listing with a tiny print run and no stated tier stays unbadged, and one
  // with no quantity at all can still be marked ultra rare.
  it("ignores quantity entirely", () => {
    expect(getRarity("5,000")).toBeNull();
    expect(getRarity("ultra-rare", "Quantity unknown, maybe a dozen survive")?.tier).toBe(
      "ultra-rare",
    );
  });
});
