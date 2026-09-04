"use client";

import { useEffect } from "react";

// The offset rides on the history entry's own state object, so it is scoped to
// that entry: arriving from a nav link creates a fresh entry with no offset and
// starts at the top, and only Back/Forward (or a reload) returns to an entry
// that carries one. Nothing to clean up, and no key collisions between pages.
const SCROLL_KEY = "__bobbleScrollY";

// How long to keep waiting for the page to grow tall enough to hold the saved
// offset. Pages that use this fetch their list client-side, so on arrival they
// are one screen of filters and the offset can't be applied yet.
const RESTORE_TIMEOUT_MS = 5000;

// Saves are throttled rather than written per scroll event: Safari rate-limits
// replaceState (~100 calls per 30s) and throws once you pass it. At this
// interval continuous scrolling stays well under the limit, and the trailing
// write means the last position before leaving is always the one saved.
const SAVE_THROTTLE_MS = 500;

// Deliberate scrolling by the reader cancels a pending restore. Plain
// pointerdown/touchstart is deliberately not in here — tapping a card while the
// list is still loading shouldn't cost you your place.
const ABORT_EVENTS = ["wheel", "touchmove", "keydown"] as const;

function savedScrollY(): number {
  const value = (window.history.state as Record<string, unknown> | null)?.[SCROLL_KEY];
  return typeof value === "number" && value > 0 ? value : 0;
}

/**
 * Restores the window scroll position when the reader returns to this page with
 * Back/Forward, and keeps the current position saved while they're on it.
 *
 * The browser's own restore is no help on a page whose list is fetched in the
 * client: at the moment it fires the page is a single screen tall, so there is
 * nowhere to scroll to and you land at the top. This waits — up to
 * {@link RESTORE_TIMEOUT_MS} — for the content to render tall enough, then
 * jumps once. If the list comes back shorter than it was (a listing removed, a
 * filter matching less), it lands as far down as the page now goes.
 *
 * Pair it with URL-backed filter state, or the restored offset points into a
 * list rebuilt from the defaults. Any page doing that must also preserve the
 * existing history state when it mirrors its view into the URL —
 * `replaceState(window.history.state, "", url)`, not `replaceState(null, …)`,
 * which drops the saved offset along with everything else.
 */
export function useScrollRestoration(): void {
  useEffect(() => {
    const pathname = window.location.pathname;
    let lastSaved = savedScrollY();
    let restoring = lastSaved > 0;
    let restoreFrame = 0;
    let saveTimer = 0;

    function writeScroll(y: number) {
      if (y === lastSaved) return;
      lastSaved = y;
      // Spreading the current state keeps Next's router internals intact — and
      // because the copy still carries `__NA`, Next's patched replaceState
      // takes its fast path instead of dispatching a router restore for what is
      // only a scroll offset.
      window.history.replaceState({ ...window.history.state, [SCROLL_KEY]: y }, "");
    }

    function onScroll() {
      // While a restore is pending the position on screen is still the arrival
      // one; saving it would overwrite the offset being restored to.
      if (restoring || saveTimer) return;
      saveTimer = window.setTimeout(() => {
        saveTimer = 0;
        writeScroll(window.scrollY);
      }, SAVE_THROTTLE_MS);
    }

    function stopRestoring() {
      restoring = false;
      if (restoreFrame) cancelAnimationFrame(restoreFrame);
      restoreFrame = 0;
      for (const type of ABORT_EVENTS) window.removeEventListener(type, stopRestoring);
    }

    if (restoring) {
      const target = lastSaved;
      const deadline = performance.now() + RESTORE_TIMEOUT_MS;
      const step = () => {
        restoreFrame = 0;
        // Cancelling doesn't help against a frame that was already dispatched
        // when the reader grabbed the page, so the flag is checked here too.
        if (!restoring) return;
        const furthest = document.documentElement.scrollHeight - window.innerHeight;
        if (furthest >= target || performance.now() >= deadline) {
          window.scrollTo(0, Math.max(0, Math.min(target, furthest)));
          stopRestoring();
          return;
        }
        restoreFrame = requestAnimationFrame(step);
      };
      for (const type of ABORT_EVENTS) {
        window.addEventListener(type, stopRestoring, { passive: true });
      }
      restoreFrame = requestAnimationFrame(step);
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      stopRestoring();
      if (saveTimer) {
        window.clearTimeout(saveTimer);
        // Flush the throttled write, unless we're being unmounted by a
        // navigation that has already swapped the URL — the entry in history is
        // the destination's by then, and this page's offset doesn't belong on it.
        if (window.location.pathname === pathname) writeScroll(window.scrollY);
      }
    };
  }, []);
}
