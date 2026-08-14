import type { AuthError } from "@supabase/supabase-js";

/**
 * Turns a Supabase Auth failure into something worth showing a stranger.
 *
 * Supabase writes its messages for the developer reading a stack trace, not for
 * the person halfway through signing up: on 2026-08-14 a visitor to the sign-up
 * form was told "email rate limit exceeded" in red, which names our
 * configuration rather than anything they did or can do. Every user-facing auth
 * path goes through here instead.
 *
 * Keyed on `error.code` — the stable identifier auth-js has carried since v2 —
 * rather than on the message text, which Supabase rewords between releases.
 */

// Only the codes this app can actually produce: email/password sign-in and
// sign-up, Google and GitHub OAuth, password recovery, and profile updates.
// The full GoTrue list runs to eighty-odd codes, most of them for MFA, SAML and
// phone auth that we don't offer — mapping those would be inventing copy for
// screens that don't exist.
const MESSAGES_BY_CODE: Record<string, string> = {
  // The one that started this. Deliberately vague about whose limit it is:
  // "we've sent" is true and reads as a queue, not as an accusation.
  over_email_send_rate_limit:
    "We've sent a lot of email in the last few minutes. Please wait a moment and try again.",
  over_request_rate_limit: "Too many attempts. Please wait a moment and try again.",

  invalid_credentials: "That email or password isn't right.",
  email_not_confirmed:
    "This account still needs confirming — check your email for the link we sent.",
  user_already_exists: "There's already an account with that email. Try signing in instead.",
  email_exists: "There's already an account with that email. Try signing in instead.",
  user_not_found: "We couldn't find an account with that email.",
  user_banned: "This account has been suspended. Get in touch if you think that's a mistake.",

  weak_password: "That password is too easy to guess. Try a longer one.",
  same_password: "That's already your password. Pick a different one.",
  email_address_invalid: "That doesn't look like a working email address.",

  // Recovery and OAuth links are single-use and short-lived; all three of these
  // mean the same thing to the person holding a dead link.
  otp_expired: "That link has expired. Request a new one and try again.",
  flow_state_expired: "That link has expired. Request a new one and try again.",
  flow_state_not_found: "That link has already been used. Request a new one and try again.",

  signup_disabled: "New accounts are closed at the moment.",
  provider_disabled: "That sign-in method isn't available right now.",
  email_provider_disabled: "Email sign-up isn't available right now.",
  captcha_failed: "The bot check didn't go through. Please try again.",

  // Auth's own 500. Distinct from a rate limit: nothing the visitor does
  // differently will help, so don't suggest a fix that won't work.
  unexpected_failure: "Something went wrong on our end. Please try again in a moment.",
};

/**
 * The message for a failure that never reached Supabase — the request itself
 * died. auth-js signals this with status 0: `AuthRetryableFetchError` is
 * constructed as `new AuthRetryableFetchError(message, 0)` on both of its
 * network paths, while every error built from an actual response gets a real
 * status (`error.status || 500`). So status 0 is the one reliable "you're
 * offline" tell — the message itself is whatever fetch happened to throw.
 */
const OFFLINE_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

type AuthErrorLike = Pick<AuthError, "message"> & Partial<Pick<AuthError, "code" | "status">>;

/**
 * Maps an auth error to display copy. Null in, null out, so a caller can hand
 * over `error` from a Supabase response without checking it first.
 *
 * An unrecognised code falls through to Supabase's own message rather than to a
 * generic "something went wrong". A specific sentence we didn't write still
 * tells the visitor — and whoever they forward the screenshot to — more than a
 * shrug does; the codes above cover what this app can actually hit, so landing
 * here means something genuinely unanticipated happened.
 */
export function authErrorMessage(error: AuthErrorLike | null | undefined): string | null {
  if (!error) return null;

  const mapped = error.code ? MESSAGES_BY_CODE[error.code] : undefined;
  if (mapped) return mapped;

  if (error.status === 0) return OFFLINE_MESSAGE;

  // A code we don't recognise but a 429 alongside it is still a rate limit of
  // some kind, and "please wait" is the right advice without knowing which.
  if (error.status === 429) return MESSAGES_BY_CODE.over_request_rate_limit;

  return error.message;
}

/**
 * The same mapping for Supabase's implicit OAuth flow, which reports failures as
 * URL parameters on the redirect back rather than as an AuthError — see the
 * redirect handler in lib/auth.tsx. `error_code` carries the same vocabulary as
 * `AuthError.code`, so the table above applies unchanged.
 */
export function authErrorMessageForCode(
  code: string | null | undefined,
  fallback: string,
): string {
  return (code ? MESSAGES_BY_CODE[code] : undefined) ?? fallback;
}
