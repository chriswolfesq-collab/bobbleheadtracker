import { describe, expect, it } from "vitest";
import { storageKeyForFile } from "@/lib/storageKey";

// Supabase Storage's allowed-key set; a key with anything else is rejected as
// "Invalid key". A UUID prefix plus a segment prefix are the only structure we
// add, so the whole key must stay within this set for every input.
const SUPABASE_SAFE = /^[A-Za-z0-9/._-]+$/;

describe("storageKeyForFile", () => {
  it("drops spaces and other unsafe characters from device filenames", () => {
    const key = storageKeyForFile("Screenshot 2026-07-23 at 4.58.24 PM.png");
    expect(key).toMatch(SUPABASE_SAFE);
    expect(key).toMatch(/\.png$/);
  });

  it("keeps the (lowercased) extension so the file serves with the right type", () => {
    expect(storageKeyForFile("Photo.JPG")).toMatch(/\.jpg$/);
  });

  it("prefixes with the given segment, e.g. the user id", () => {
    const userId = "919019e1-2960-41d5-9a7b-7830da205493";
    expect(storageKeyForFile("cat.png", userId)).toMatch(
      new RegExp(`^${userId}/[0-9a-f-]+\\.png$`),
    );
  });

  it("produces a valid key even when the filename has no extension", () => {
    const key = storageKeyForFile("IMG 0001");
    expect(key).toMatch(SUPABASE_SAFE);
    expect(key).not.toContain(".");
  });

  it("is unique across calls for the same filename", () => {
    expect(storageKeyForFile("a.png")).not.toBe(storageKeyForFile("a.png"));
  });
});
