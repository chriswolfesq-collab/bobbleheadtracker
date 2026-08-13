"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  clearStashedReferralCode,
  readStashedReferralCode,
} from "@/lib/referralStorage";
import { supabase } from "@/lib/supabase";

// Re-exported so callers have a single referral entry point; the definitions
// live in referralStorage.ts to keep lib/auth.tsx out of an import cycle.
export {
  clearStashedReferralCode,
  readStashedReferralCode,
  referralUrl,
  REFERRAL_PARAM,
  stashReferralCode,
} from "@/lib/referralStorage";

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
  const [reloadKey, setReloadKey] = useState(0);

  // Refetch when the tab comes back to the front.
  //
  // Every other number on the profile changes because *you* did something, so
  // a one-shot fetch is fine for them. This one changes because someone else
  // did — a friend signing up, hours later. Without this, a tab left open
  // since before that happened shows a stale 0 indefinitely, and the collector
  // concludes their referral wasn't counted.
  useEffect(() => {
    function refetch() {
      if (document.visibilityState === "visible") setReloadKey((key) => key + 1);
    }

    document.addEventListener("visibilitychange", refetch);
    window.addEventListener("focus", refetch);
    return () => {
      document.removeEventListener("visibilitychange", refetch);
      window.removeEventListener("focus", refetch);
    };
  }, []);

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
          // Cleared on success so a transient failure doesn't leave the error
          // showing next to numbers that have since loaded fine.
          setError(null);
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
    // isLoading is deliberately never set back to true on a refetch: the
    // numbers already on screen are better than blanking them every time the
    // tab regains focus.
  }, [userId, reloadKey]);

  return userId
    ? { ...referral, isLoading, error }
    : { ...EMPTY, isLoading: false, error: null };
}

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
