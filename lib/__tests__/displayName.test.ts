import { describe, expect, it } from "vitest";
import { MAX_DISPLAY_NAME_LENGTH, validateDisplayName } from "@/lib/auth";

describe("validateDisplayName", () => {
  it("accepts an ordinary name", () => {
    expect(validateDisplayName("Chris Wolfe")).toBeNull();
  });

  it("rejects blank and whitespace-only names", () => {
    expect(validateDisplayName("")).toBe("Please enter a name.");
    expect(validateDisplayName("   ")).toBe("Please enter a name.");
  });

  it("accepts a name exactly at the limit and rejects one character more", () => {
    expect(validateDisplayName("a".repeat(MAX_DISPLAY_NAME_LENGTH))).toBeNull();
    expect(validateDisplayName("a".repeat(MAX_DISPLAY_NAME_LENGTH + 1))).toContain(
      String(MAX_DISPLAY_NAME_LENGTH),
    );
  });

  // The limit applies to what actually gets stored, and the write paths trim
  // before storing — so padding shouldn't push a legitimate name over.
  it("measures the trimmed name, not the padding around it", () => {
    const atLimit = "a".repeat(MAX_DISPLAY_NAME_LENGTH);
    expect(validateDisplayName(`   ${atLimit}   `)).toBeNull();
  });

  it("leaves room for a genuinely long real name", () => {
    expect(validateDisplayName("Bartholomew Fitzwilliam")).toBeNull();
  });
});
