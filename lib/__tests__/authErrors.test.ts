import { describe, expect, it } from "vitest";
import { authErrorMessage, authErrorMessageForCode } from "@/lib/authErrors";

describe("authErrorMessage", () => {
  // The failure that prompted this mapping: on 2026-08-14 a visitor to the
  // sign-up form was shown "email rate limit exceeded" verbatim.
  it("replaces the email rate limit message rather than passing it through", () => {
    const message = authErrorMessage({
      message: "email rate limit exceeded",
      code: "over_email_send_rate_limit",
      status: 429,
    });

    expect(message).not.toContain("rate limit");
    expect(message).toBe(
      "We've sent a lot of email in the last few minutes. Please wait a moment and try again.",
    );
  });

  it("passes null straight through so callers needn't check first", () => {
    expect(authErrorMessage(null)).toBeNull();
    expect(authErrorMessage(undefined)).toBeNull();
  });

  it("maps on the code, not on Supabase's wording", () => {
    // Same code, message reworded as it might be in a future auth-js release.
    expect(
      authErrorMessage({ message: "Invalid login credentials", code: "invalid_credentials", status: 400 }),
    ).toBe("That email or password isn't right.");
    expect(
      authErrorMessage({ message: "Wrong email or password", code: "invalid_credentials", status: 400 }),
    ).toBe("That email or password isn't right.");
  });

  it("gives the two already-registered codes the same answer", () => {
    const existing = "There's already an account with that email. Try signing in instead.";
    expect(authErrorMessage({ message: "User already registered", code: "user_already_exists", status: 422 })).toBe(
      existing,
    );
    expect(authErrorMessage({ message: "Email address already in use", code: "email_exists", status: 422 })).toBe(
      existing,
    );
  });

  // auth-js builds AuthRetryableFetchError with status 0 when the request never
  // completed; anything built from a real response carries a real status.
  it("reads status 0 as a connection failure rather than a rejection", () => {
    expect(authErrorMessage({ message: "Failed to fetch", status: 0 })).toBe(
      "Couldn't reach the server. Check your connection and try again.",
    );
  });

  // A server rejection that predates error codes still has to reach the user —
  // silently swallowing it would let the form claim success.
  it("keeps the message on a code-less error that did come from the server", () => {
    expect(authErrorMessage({ message: "New password should be different.", status: 422 })).toBe(
      "New password should be different.",
    );
  });

  // A 429 we don't have specific copy for is still a rate limit; "please wait"
  // is right even when we can't say which limit was hit.
  it("falls back to the generic wait message on an unmapped 429", () => {
    expect(authErrorMessage({ message: "slow down", code: "over_sms_send_rate_limit", status: 429 })).toBe(
      "Too many attempts. Please wait a moment and try again.",
    );
  });

  // Deliberate: a specific sentence we didn't write beats a generic shrug for
  // anything genuinely unanticipated.
  it("falls back to Supabase's own message for an unrecognised code", () => {
    expect(
      authErrorMessage({ message: "SAML metadata could not be fetched", code: "saml_metadata_fetch_failed", status: 500 }),
    ).toBe("SAML metadata could not be fetched");
  });
});

describe("authErrorMessageForCode", () => {
  // Supabase's implicit OAuth flow reports failures as URL params on the
  // redirect back, where error_code carries the same vocabulary.
  it("maps an OAuth redirect's error_code to the same copy", () => {
    expect(authErrorMessageForCode("over_email_send_rate_limit", "Sign-in failed. Please try again.")).toBe(
      "We've sent a lot of email in the last few minutes. Please wait a moment and try again.",
    );
  });

  it("keeps the caller's fallback when there is no code or no mapping", () => {
    const fallback = "Sign-in failed. Please try again.";
    expect(authErrorMessageForCode(null, fallback)).toBe(fallback);
    expect(authErrorMessageForCode("", fallback)).toBe(fallback);
    expect(authErrorMessageForCode("something_new", fallback)).toBe(fallback);
  });
});
