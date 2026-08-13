"use client";

/**
 * The invite code's parking space, kept free of every other dependency.
 *
 * Split out of lib/referrals.ts because lib/auth.tsx needs to read the stashed
 * code at signup, and referrals.ts imports useAuth for its hook — importing it
 * back would be a cycle. Nothing here touches Supabase or React, so both sides
 * can depend on it safely.
 */

/** The query parameter an invite link carries. */
export const REFERRAL_PARAM = "ref";

const STORAGE_KEY = "bobbleshelf.referral";

/** The full invite URL for a code. Origin-relative so previews and localhost
 *  produce a link that actually works where it was generated. */
export function referralUrl(code: string, origin: string): string {
  return `${origin}/?${REFERRAL_PARAM}=${encodeURIComponent(code)}`;
}

/**
 * Parks an invite code for later. Called on landing, not on signup — the two
 * are separated by an email confirmation link (a fresh tab) or an OAuth
 * redirect, either of which loses the query string.
 *
 * Storage failures are swallowed: Safari private mode throws on setItem, and a
 * referral quietly not being recorded is far better than a crash on the
 * homepage.
 */
export function stashReferralCode(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch (error) {
    console.error("Couldn't stash the referral code:", error);
  }
}

export function readStashedReferralCode(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error("Couldn't read the stashed referral code:", error);
    return null;
  }
}

export function clearStashedReferralCode(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Couldn't clear the stashed referral code:", error);
  }
}
