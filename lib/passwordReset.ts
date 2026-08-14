import { authErrorMessage } from "@/lib/authErrors";
import { supabase } from "@/lib/supabase";

// Where a recovery link lands. Supabase redirects here with the one-time token
// in the URL hash; the shared client picks that up (detectSessionInUrl, on by
// default) and turns it into a session, which app/reset-password then uses to
// let them set a new password.
//
// This path must also be listed under Authentication > URL Configuration >
// Redirect URLs in the Supabase dashboard, or Supabase ignores it and drops
// everyone on the Site URL instead — see supabase/SETUP.md.
export const RESET_PASSWORD_PATH = "/reset-password";

// Supabase Auth's own floor, mirrored here so the form rejects a too-short
// password before a round-trip rather than after. Same number the sign-up field
// enforces in components/AuthModal.tsx.
export const MIN_PASSWORD_LENGTH = 6;

/** The single definition of an acceptable new password. Null when it's fine. */
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  // Checked here rather than only on the second field, since the typo could be
  // in either one and there's no way to see what was typed.
  if (password !== confirmation) {
    return "Those passwords don't match.";
  }
  return null;
}

/**
 * Emails a password-recovery link to an address.
 *
 * This is how an admin unsticks someone locked out of their account: no
 * password passes through the console, and the admin never learns it — the
 * recipient chooses their own on the reset page. Works for any account with an
 * email, including a Google sign-up, which gains a password it can also use.
 *
 * Supabase deliberately reports success whether or not the address belongs to
 * an account, so a caller can't use this to probe who has one. That means a
 * "sent" result is not proof the person exists.
 */
export async function sendPasswordReset(
  email: string,
  captchaToken?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    captchaToken,
    redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}`,
  });

  return { error: authErrorMessage(error) };
}
