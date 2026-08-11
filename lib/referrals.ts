"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// The query parameter an invite link carries, and the localStorage key it's
// parked in until a session exists to attribute it to. Exported because two
// unrelated places need to agree on them: ReferralCapture, which writes, and
// the invite links the Refer a Friend panel builds.
export const REFERRAL_PARAM = "ref";
const STORAGE_KEY = "bobbleshelf.referral";

export type MyReferral = {
  /** null until the first successful load — the code is minted server-side on
   *  demand, so there's nothing to show before the round trip completes. */
  code: string | null;
  /** Friends who signed up through your link. */
  joined: number;
  /** Of those, the ones that count as a raffle entry: email confirmed and a
   *  few bobbleheads marked owned. The bar lives in SQL
   *  (referral_qualifying_owned) so the drawing and this number can't drift. */
  qualified: number;
};

const EMPTY: MyReferral = { code: null, joined: 0, qualified: 0 };

/**
 * The signed-in user's invite code and referral counts.
 *
 * One RPC rather than a table read: profiles has no client-visible referral
 * surface, the code is minted lazily on first call, and the qualified count has
 * to look at auth.users, which the client can't reach. See
 * supabase/referrals.sql.
 */
export function useMyReferral(): MyReferral & { isLoading: boolean; error: string | null } {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [referral, setReferral] = useState<MyReferral>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    supabase
      .rpc("my_referral")
      .maybeSingle<{ code: string; joined: number; qualified: number }>()
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;

        if (rpcError) {
          console.error("Failed to load your referral link:", rpcError.message);
          setError("Couldn't load your invite link. Refresh to try again.");
        } else if (data) {
          setReferral({
            code: data.code,
            joined: data.joined ?? 0,
            qualified: data.qualified ?? 0,
          });
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return userId
    ? { ...referral, isLoading, error }
    : { ...EMPTY, isLoading: false, error: null };
}

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

/**
 * Attributes the current session to a stashed invite code, if there is one.
 *
 * Every outcome except a transport failure clears the stash. The rejections
 * (your own link, an account that's already attributed, one too old to count)
 * are all permanent — retrying on the next page load would never change the
 * answer, and a code that sticks around forever would eventually attach itself
 * to the wrong account on a shared computer.
 */
export async function claimStashedReferral(): Promise<void> {
  const code = readStashedReferralCode();
  if (!code) return;

  const { data, error } = await supabase.rpc("claim_referral", { p_code: code });

  if (error) {
    // Left in place on purpose: this is the one case that might succeed later.
    console.error("Failed to claim the referral:", error.message);
    return;
  }

  clearStashedReferralCode();
  if (data !== "claimed") {
    console.info(`Referral not recorded: ${data}`);
  }
}
