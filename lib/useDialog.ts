"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableWithin(node: HTMLElement): HTMLElement[] {
  // Disabled controls are already excluded by the selector. We deliberately
  // don't filter on visibility (e.g. offsetParent): these dialogs don't hide
  // focusable children mid-panel, and offsetParent is unreliable inside a
  // position:fixed overlay.
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Shared modal-dialog behavior: Escape-to-close, a focus trap that keeps Tab
 * inside the panel, initial focus on open, and focus restore to whatever was
 * focused before the dialog opened. Attach the returned ref to the panel
 * element (the box, not the backdrop) and give that element
 * `role="dialog" aria-modal="true"` plus an `aria-labelledby` pointing at its
 * heading. If the panel has no focusable children, give it `tabIndex={-1}` so
 * initial focus has somewhere to land.
 *
 * `active` gates the wiring: pass `true` from a dialog that is only mounted
 * while open, or the open-state boolean from one that stays mounted and toggles.
 * `onClose` is read through a ref, so an inline handler won't re-arm the effect.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  // Keep the latest onClose without re-arming the main effect, so an inline
  // handler doesn't tear down and rebuild the listener/focus wiring each render.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the dialog so keyboard and screen-reader users start
    // inside it rather than back on the page behind the backdrop.
    const initial = focusableWithin(node);
    (initial[0] ?? node).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = focusableWithin(node!);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement;

      if (event.shiftKey && activeEl === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    }

    node.addEventListener("keydown", onKeyDown);

    return () => {
      node.removeEventListener("keydown", onKeyDown);
      // Restore focus to the trigger so keyboard users aren't dumped at the top
      // of the page when the dialog closes.
      previouslyFocused?.focus?.();
    };
  }, [active]);

  return ref;
}
