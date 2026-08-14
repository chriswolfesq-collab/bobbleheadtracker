"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { type Award, type AwardFacts, evaluateAwards } from "@/lib/awards";
import { publicAsset } from "@/lib/paths";

// The award ids this device has already congratulated this member for, keyed
// per user id so two accounts on one browser don't inherit each other's
// history. Device-local on purpose: missing a celebration (private browsing, a
// new laptop) costs nothing, and the alternative is a database write on every
// profile load just to decide whether to show a modal.
const ACKED_KEY_PREFIX = "bht:awards-acked:";

function readAcked(userId: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(ACKED_KEY_PREFIX + userId);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    // Unavailable, or a value from an older shape that no longer parses.
    // Treated as "nothing to celebrate", which is the quiet failure rather
    // than a modal on every single visit.
    return null;
  }
}

function writeAcked(userId: string, ids: string[]) {
  try {
    window.localStorage.setItem(ACKED_KEY_PREFIX + userId, JSON.stringify(ids));
  } catch {
    // Nothing to persist to. The modal is closed for this session either way;
    // worst case it reappears on the next visit.
  }
}

/**
 * The "you just earned an award" moment.
 *
 * Fires when something is earned that this device hasn't already acknowledged —
 * so it lands on the visit *after* the tenth bobblehead goes on the shelf,
 * which is exactly when someone is deciding whether to keep going.
 *
 * The first run for an account seeds the marker silently instead of
 * celebrating. Without that, shipping this would greet every existing collector
 * with a modal for awards they earned months ago, and a member with 300
 * bobbleheads would get it six times over. Nobody's first impression of a
 * reward should be a backlog.
 *
 * Several can land at once — one shopping trip can clear a count rung and a
 * team rung together. All of them are acknowledged, and the last one in shelf
 * order gets the modal, with the rest named underneath.
 */
export function AwardCelebration({
  userId,
  facts,
  isLoading = false,
}: {
  userId: string;
  facts: AwardFacts;
  /** Facts still loading. Acting on the interim zeroes would seed the marker
   *  empty and then "celebrate" every award the member already had. */
  isLoading?: boolean;
}) {
  const [unlocked, setUnlocked] = useState<Award[] | null>(null);

  const { awards } = evaluateAwards(facts);
  // A stable key so the effect doesn't re-run on every render just because
  // evaluateAwards returned a fresh array of the same awards.
  const earnedIds = awards
    .filter((award) => award.earned)
    .map((award) => award.id)
    .join(",");

  useEffect(() => {
    if (isLoading) return;

    const earned = earnedIds ? earnedIds.split(",") : [];
    const acked = readAcked(userId);

    // First time we've ever looked at this account on this device: record where
    // they already stand and say nothing.
    if (acked === null) {
      writeAcked(userId, earned);
      return;
    }

    const fresh = earned.filter((id) => !acked.includes(id));
    if (fresh.length === 0) return;

    // Acknowledge as soon as it's shown rather than on dismiss: a member who
    // closes the tab instead of clicking the button has still seen it, and
    // re-showing it on the next visit would read as a bug. Union rather than
    // overwrite, so an award that stops being earned — a listing gets deleted
    // out from under a count — doesn't get celebrated a second time when it
    // comes back.
    writeAcked(userId, Array.from(new Set([...acked, ...earned])));

    // localStorage is the external system here, and it can't be read during
    // render — the server has no window, and the marker has to be read before
    // it's written back. So the decision can only be made after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnlocked(awards.filter((award) => fresh.includes(award.id)));
    // `awards` is derived from earnedIds and deliberately not a dependency:
    // it's a new array every render and would re-run this on every one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, earnedIds, isLoading]);

  if (!unlocked || unlocked.length === 0) return null;

  // Last in shelf order is the hardest-won of the batch.
  const headline = unlocked[unlocked.length - 1];
  const alsoEarned = unlocked.slice(0, -1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="award-title"
      onClick={() => setUnlocked(null)}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 text-center shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.35em] text-brass">
          {unlocked.length > 1 ? `${unlocked.length} awards unlocked` : "Award unlocked"}
        </p>

        <div
          aria-hidden
          className="mx-auto mt-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-brass/50 bg-brass/10 text-4xl"
        >
          {headline.teamSlug ? (
            <Image
              src={publicAsset(`/bobbleheads/${headline.teamSlug}.png`)}
              alt=""
              width={677}
              height={1607}
              sizes="80px"
              className="h-[4.5rem] w-auto drop-shadow-[0_3px_4px_rgba(0,0,0,0.4)]"
            />
          ) : (
            headline.icon
          )}
        </div>

        <h2 id="award-title" className="mt-4 text-2xl font-black text-zinc-900">
          {headline.name}
        </h2>
        <p className="mt-1 text-xs font-black uppercase tracking-wide text-accent">
          {headline.requirement}
        </p>
        <p className="mt-3 text-sm leading-6 text-zinc-600">{headline.blurb}</p>

        {alsoEarned.length > 0 ? (
          <ul className="mt-4 space-y-1 border-t border-black/10 pt-4 text-xs text-zinc-600">
            {alsoEarned.map((award) => (
              <li key={award.id}>
                <span aria-hidden className="mr-1.5">
                  {award.icon}
                </span>
                <span className="font-bold text-zinc-900">{award.name}</span> · {award.requirement}
              </li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          onClick={() => setUnlocked(null)}
          className="mt-6 w-full rounded-lg bg-accent px-3 py-2.5 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover"
        >
          Nice
        </button>
      </div>
    </div>
  );
}
