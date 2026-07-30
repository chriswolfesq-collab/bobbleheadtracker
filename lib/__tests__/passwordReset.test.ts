import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/passwordReset";

describe("validateNewPassword", () => {
  it("accepts a matching password at the minimum length", () => {
    const password = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(validateNewPassword(password, password)).toBeNull();
  });

  it("rejects one character under the minimum", () => {
    const password = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validateNewPassword(password, password)).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("rejects a mismatch between the two fields", () => {
    expect(validateNewPassword("correct-horse", "correct-hoarse")).toBe(
      "Those passwords don't match.",
    );
  });

  // Length is reported first: telling someone their two too-short passwords
  // don't match sends them to fix the wrong problem.
  it("reports the length problem before the mismatch", () => {
    expect(validateNewPassword("abc", "xyz")).toContain(String(MIN_PASSWORD_LENGTH));
  });

  // Unlike a display name, surrounding spaces are part of the password — they
  // are what the user will have to type next time, so they must not be trimmed
  // away here or the stored password won't match what they think they set.
  it("treats padding as part of the password rather than trimming it", () => {
    const padded = `  ${"a".repeat(MIN_PASSWORD_LENGTH)}  `;
    expect(validateNewPassword(padded, padded)).toBeNull();
    expect(validateNewPassword(padded, padded.trim())).toBe("Those passwords don't match.");
  });
});
