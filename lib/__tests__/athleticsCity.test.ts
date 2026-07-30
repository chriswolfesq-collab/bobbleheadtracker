import { describe, expect, it } from "vitest";
import { defaultCityForYear, hasCityChoice, resolveAthleticsCity } from "@/lib/athleticsCity";

describe("hasCityChoice", () => {
  it("is only offered on the Athletics", () => {
    expect(hasCityChoice("athletics")).toBe(true);
    expect(hasCityChoice("giants")).toBe(false);
  });
});

describe("defaultCityForYear", () => {
  it("splits the eras at the 2024 season", () => {
    expect(defaultCityForYear("2019")).toBe("Oakland");
    expect(defaultCityForYear("2024")).toBe("Oakland");
    expect(defaultCityForYear("2025")).toBe("Sacramento");
    expect(defaultCityForYear("2026")).toBe("Sacramento");
  });

  it("declines to guess without a year", () => {
    expect(defaultCityForYear("Unknown")).toBeNull();
    expect(defaultCityForYear("")).toBeNull();
  });
});

describe("resolveAthleticsCity", () => {
  it("prefers the stored pick over the year", () => {
    expect(resolveAthleticsCity("athletics", "2025", "Oakland")).toBe("Oakland");
    expect(resolveAthleticsCity("athletics", "2019", "Sacramento")).toBe("Sacramento");
  });

  it("falls back to the year when nothing is stored", () => {
    expect(resolveAthleticsCity("athletics", "2019", null)).toBe("Oakland");
    expect(resolveAthleticsCity("athletics", "2025", undefined)).toBe("Sacramento");
  });

  it("ignores a stored value that isn't one of the two cities", () => {
    expect(resolveAthleticsCity("athletics", "2019", "Las Vegas")).toBe("Oakland");
  });

  it("stays out of every other team", () => {
    expect(resolveAthleticsCity("giants", "2019", "Oakland")).toBeNull();
  });
});
