"use client";

import { useTheme } from "@/lib/theme";

// Compact header control that flips between light and dark in one click. It sets
// an explicit "light"/"dark" preference (leaving "system" reachable from the
// fuller control in Settings > Appearance). The label names the mode the click
// will switch to, with a matching icon.
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolvedTheme, setPreference } = useTheme();
  const isDark = resolvedTheme === "dark";
  const targetLabel = isDark ? "Light Mode" : "Dark Mode";

  return (
    <button
      type="button"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      onClick={() => setPreference(isDark ? "light" : "dark")}
      className={`flex items-center gap-1.5 rounded border border-black/15 px-2 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover dark:border-white/20 dark:text-zinc-200 dark:hover:text-accent-hover sm:px-3 ${className ?? ""}`}
    >
      {isDark ? (
        // Sun — currently dark, click to go light.
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // Moon — currently light, click to go dark.
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      <span className="hidden sm:inline">{targetLabel}</span>
    </button>
  );
}
