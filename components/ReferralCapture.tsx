"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { claimStashedReferral } from "@/lib/referrals";
import { REFERRAL_PARAM, stashReferralCode } from "@/lib/referralStorage";

/**
 * Records who sent the invite that brought someone here.
 *
 * Renders nothing; mounted once in the root layout because an invite link can
 * point at any page, not just the homepage.
 *
 * Two halves, deliberately decoupled:
 *
 *   Landing — park the ?ref code in localStorage and scrub it from the URL.
 *   Session — once a user exists, hand the parked code to claim_referral.
 *
 * They're split because the gap between them is not a single page view. Email
 * signup goes away to a confirmation link that opens a fresh tab; Google and
 * GitHub bounce through a redirect. Either loses the query string, so reading
 * ?ref at the moment of signup would attribute almost nothing.
 */
export function ReferralCapture() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const claimedFor = useRef<string | null>(null);

  // Landing.
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get(REFERRAL_PARAM)?.trim();
    if (!code) return;

    stashReferralCode(code);

    // Scrub it so the address someone copies out of their bar isn't still
    // carrying the last person's invite code, which would misattribute the
    // next signup. Only this param — anything else in the URL is left alone.
    url.searchParams.delete(REFERRAL_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  // Session. Guarded per user id rather than run once: the provider resolves
  // the session asynchronously, so this effect sees null first and the real id
  // a tick later, and a sign-out/sign-in in the same visit must be able to
  // claim again for the new account.
  useEffect(() => {
    if (!userId || claimedFor.current === userId) return;

    claimedFor.current = userId;
    void claimStashedReferral();
  }, [userId]);

  return null;
}
