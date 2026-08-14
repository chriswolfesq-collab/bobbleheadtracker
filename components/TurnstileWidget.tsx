"use client";

import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";

// Cloudflare Turnstile's explicit-render API, loaded on demand. Only the
// pieces this component calls are declared.
type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
      theme: "light" | "dark" | "auto";
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// render=explicit stops the script from auto-rendering into any element with a
// turnstile class — we place the widget ourselves, below.
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// One script load shared by every widget instance (the sign-in form and the
// forgot-password form each mount their own widget as the user moves between
// them). A failed load clears the promise so the next mount can retry.
let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Failed to load the Turnstile script."));
      };
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
}

/**
 * The CAPTCHA challenge for the auth forms. Renders nothing at all when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset (see lib/turnstile.ts), so the rest
 * of the form doesn't need to know whether CAPTCHA is on.
 *
 * onToken fires with a token when the (usually invisible) challenge passes,
 * and with null when the token expires or errors — the caller should gate its
 * submit button on having one. Bump resetSignal after a FAILED auth attempt:
 * tokens are single-use, so the consumed one must be traded for a fresh
 * challenge before the person can retry.
 *
 * onUnavailable fires when the script can't be fetched at all, which an ad
 * blocker is enough to cause. Without it the gated submit button would sit
 * disabled with nothing on screen explaining why — the widget renders no UI of
 * its own until the script that draws it arrives.
 */
export function TurnstileWidget({
  onToken,
  onUnavailable,
  resetSignal = 0,
}: {
  onToken: (token: string | null) => void;
  onUnavailable?: () => void;
  resetSignal?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Ref'd so the render effect can run once without going stale if the parent
  // passes a new callback identity on re-render.
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;

    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || widgetIdRef.current !== null) return;

        widgetIdRef.current = window.turnstile!.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
          // The auth modal is a white card in both site themes.
          theme: "light",
        });
      })
      .catch(() => {
        // Script blocked (adblock, network). Leave the token null: the submit
        // button stays disabled, which is still better than a submit that the
        // server will definitely reject. Tell the parent so it can say so.
        if (!cancelled) onUnavailableRef.current?.();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current !== null) {
      // The old token was consumed by the failed attempt; invalidate it locally
      // and ask for a new challenge.
      onTokenRef.current(null);
      window.turnstile?.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  if (!TURNSTILE_SITE_KEY) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
