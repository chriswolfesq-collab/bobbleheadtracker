"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

// The three choices the user can pick. "system" tracks the OS setting live;
// "light"/"dark" pin the app regardless of the OS.
export type ThemePreference = "system" | "light" | "dark";

// What actually gets applied to the page — "system" resolves to one of these.
export type ResolvedTheme = "light" | "dark";

// Shared between the inline no-flash script (app/layout.tsx) and this provider so
// the two never drift. Anything reading/writing the stored preference or toggling
// the class must use these exact names.
export const THEME_STORAGE_KEY = "bobbleshelf-theme";
export const THEME_DARK_CLASS = "dark";

// Fired on the window after we write the preference, so the useSyncExternalStore
// subscription re-reads within the same tab (the native "storage" event only
// fires in *other* tabs).
const THEME_CHANGE_EVENT = "bobbleshelf-theme-change";

type ThemeContextValue = {
  /** The user's saved choice: "system" | "light" | "dark". */
  preference: ThemePreference;
  /** The theme currently painted on screen: "light" | "dark". */
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// --- External store: the persisted preference -----------------------------
// Read via useSyncExternalStore rather than useState+effect so it stays correct
// across tabs and hydrates without a set-state-in-effect.

function subscribePreference(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function getPreferenceSnapshot(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

// The server has no stored preference or OS signal; default to "system" so the
// SSR markup is stable. The no-flash script has already set the real class on
// <html>, so this only affects React-rendered UI (e.g. the settings toggle),
// which reconciles to the client snapshot right after hydration.
function getPreferenceServerSnapshot(): ThemePreference {
  return "system";
}

// --- External store: the OS color-scheme ----------------------------------

function subscribeSystemDark(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSystemDarkSnapshot(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getSystemDarkServerSnapshot(): boolean {
  return false;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore(
    subscribePreference,
    getPreferenceSnapshot,
    getPreferenceServerSnapshot,
  );
  const systemIsDark = useSyncExternalStore(
    subscribeSystemDark,
    getSystemDarkSnapshot,
    getSystemDarkServerSnapshot,
  );

  const resolvedTheme: ResolvedTheme =
    preference === "system" ? (systemIsDark ? "dark" : "light") : preference;

  // Reflect the resolved theme onto <html>. This is a legitimate "sync an
  // external system" effect — it mutates the DOM, it doesn't set React state.
  useEffect(() => {
    document.documentElement.classList.toggle(
      THEME_DARK_CLASS,
      resolvedTheme === "dark",
    );
  }, [resolvedTheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private-mode / storage-disabled: the choice just won't persist.
    }
    // Notify our own tab's subscription (storage events don't fire in-tab).
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
