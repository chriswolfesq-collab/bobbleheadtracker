"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import { copyText } from "@/lib/clipboard";
import { referralUrl } from "@/lib/referralStorage";
import { useMyReferral } from "@/lib/referrals";

/**
 * Whether the referral raffle is actually running.
 *
 * Off until there are prizes in hand and published official rules. The
 * attribution underneath is live either way — referrals are being recorded and
 * counted right now, so nobody who invites a friend before launch loses credit
 * for it. This only governs what the page *promises*.
 *
 * Before flipping this to true:
 *   - Official rules exist and are linked from RULES_HREF below (eligibility,
 *     dates, odds, prize value, winner selection, sponsor) — a page that
 *     doesn't exist yet.
 *   - An alternate free method of entry is described in those rules.
 *   - Prizes are bought and the drawing cadence is decided.
 */
const IS_RAFFLE_LIVE = false;

/** Only rendered when IS_RAFFLE_LIVE. Must be a real route before then. */
const RULES_HREF = "/refer/rules";

const SHARE_TEXT =
  "I'm tracking my MLB bobblehead collection on BobbleShelf — every stadium giveaway, all 30 teams. Join me:";

function CountTile({
  value,
  label,
  hint,
}: {
  /** null when the count isn't known yet — still loading, or the load failed.
   *  Rendering 0 there is worse than rendering nothing: a collector who has
   *  actually referred someone reads it as "my referral didn't count", which
   *  is exactly the bug report this replaced. */
  value: number | null;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border-soft bg-surface px-4 py-3 text-center">
      <p className="font-display text-2xl font-bold tabular-nums text-navy">
        {value === null ? <span className="text-zinc-400">—</span> : value}
      </p>
      <p className="mt-0.5 text-[11px] font-black uppercase tracking-wide text-zinc-600">{label}</p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-zinc-500">{hint}</p> : null}
    </div>
  );
}

/**
 * The invite panel: your personal link, the ways to send it, and how many
 * friends have joined through it.
 *
 * Shared by the standalone /refer page and the Refer a Friend section on the
 * profile, which differ only in heading weight and padding.
 */
export function ReferAFriend({ variant = "page" }: { variant?: "page" | "section" }) {
  const { user, isLoading: isAuthLoading, openAuthModal } = useAuth();
  const { code, joined, qualified, isLoading, error } = useMyReferral();
  const [didCopy, setDidCopy] = useState(false);
  const { showError } = useToast();

  useEffect(() => {
    if (!didCopy) return;

    const timer = setTimeout(() => setDidCopy(false), 2000);
    return () => clearTimeout(timer);
  }, [didCopy]);

  // Read during render rather than parked in state after mount: the link is
  // only ever built once `code` has come back from the RPC, which can't happen
  // before hydration, so there's no server render of this to disagree with.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = code && origin ? referralUrl(code, origin) : null;
  const canNativeShare = typeof navigator !== "undefined" && Boolean(navigator.share);

  async function handleCopy() {
    if (!link) return;

    if (await copyText(link)) {
      setDidCopy(true);
      return;
    }
    showError("Couldn't copy. Select the link below and copy it manually.");
  }

  async function handleNativeShare() {
    if (!link) return;

    try {
      await navigator.share({ title: "BobbleShelf", text: SHARE_TEXT, url: link });
    } catch (shareError) {
      // Backing out of the share sheet is not a failure.
      if ((shareError as Error)?.name === "AbortError") return;
      console.error("Share sheet failed", shareError);
    }
  }

  const isPage = variant === "page";

  const heading = isPage ? (
    <>
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-navy">
        Refer a Friend
      </h1>
      <p className="mt-3 text-sm leading-7 text-zinc-700">
        Every collector you bring in makes the checklists better — more photos, more corrections,
        more giveaways nobody had recorded. Send them your link and you get the credit.
      </p>
    </>
  ) : (
    <>
      <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
        Refer a Friend
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Send a collector your link. Every friend who joins through it is credited to you.
      </p>
    </>
  );

  return (
    <div>
      {heading}

      {isAuthLoading ? null : !user ? (
        <div className="mt-6 rounded-xl border border-border-soft bg-surface p-6">
          <p className="text-sm leading-6 text-zinc-700">
            Sign in to get your invite link. It&apos;s tied to your account, so the friends you
            bring in are recorded against your name.
          </p>
          <Button className="mt-4" onClick={() => openAuthModal("sign-up")}>
            Sign Up Free
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-xl border border-border-soft bg-surface p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-brass">
              Your invite link
            </p>

            {error ? (
              <p className="mt-3 text-sm font-semibold text-red-500">{error}</p>
            ) : isLoading || !link ? (
              <p className="mt-3 text-sm text-zinc-600">Loading…</p>
            ) : (
              <>
                {/* select-all so one click grabs the whole URL — the manual
                    escape hatch for when copyText fails. break-all rather than
                    truncate: this is the fallback, so it has to show the link
                    in full even on a narrow phone. */}
                <p className="mt-2 select-all break-all rounded-lg bg-black/[0.04] px-3 py-2.5 font-mono text-xs text-zinc-700">
                  {link}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {canNativeShare ? (
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="flex-1 rounded-lg bg-accent px-3 py-2.5 text-[11px] font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover"
                    >
                      Share…
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex-1 rounded-lg border border-black/10 px-3 py-2.5 text-[11px] font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover"
                  >
                    {didCopy ? "Copied" : "Copy link"}
                  </button>
                  <a
                    href={`mailto:?subject=${encodeURIComponent(
                      "Come track your bobbleheads with me",
                    )}&body=${encodeURIComponent(`${SHARE_TEXT}\n\n${link}`)}`}
                    className="flex-1 rounded-lg border border-black/10 px-3 py-2.5 text-center text-[11px] font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover"
                  >
                    Email
                  </a>
                </div>
              </>
            )}
          </div>

          {/* A null code means the RPC has never come back, so the counts are
              unknown rather than zero — see CountTile. `joined` and `qualified`
              sit at 0 until it lands, so passing them straight through made the
              panel state "0 friends joined" while it was still asking.
              Keyed off the code rather than isLoading/error on purpose: once we
              have real numbers, a failed *refetch* should leave them on screen
              and just show the error underneath. */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <CountTile value={code === null ? null : joined} label="Friends joined" />
            <CountTile
              value={code === null ? null : qualified}
              label={IS_RAFFLE_LIVE ? "Raffle entries" : "Active collectors"}
              hint="Confirmed their email and put at least 3 bobbleheads on their shelf."
            />
          </div>

          {/* The counts have their own copy of the error. It used to appear
              only inside the link box above, so a failed load left two
              confident zeroes sitting here with nothing to explain them. */}
          {error ? <p className="mt-2 text-xs font-semibold text-red-500">{error}</p> : null}

          {IS_RAFFLE_LIVE ? (
            <p className="mt-3 text-xs leading-6 text-zinc-600">
              Each active collector you bring in is one entry in the bobblehead drawing.{" "}
              <a href={RULES_HREF} className="font-semibold text-accent hover:text-accent-hover">
                Official rules
              </a>
              .
            </p>
          ) : (
            // Says what is true today. The counts above are real and are being
            // kept from now on, so referrals made before the drawing opens
            // still count — but nothing here promises a prize that has no
            // published rules behind it yet.
            <p className="mt-3 text-xs leading-6 text-zinc-600">
              We&apos;re counting these from today. A bobblehead giveaway for collectors who bring
              friends in is in the works — your referrals are already on the board for it.
            </p>
          )}
        </>
      )}
    </div>
  );
}
