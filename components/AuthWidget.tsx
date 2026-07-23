"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";
import { getDisplayName, useAuth } from "@/lib/auth";

// A single account control. When signed in, everything (profile, settings,
// theme, sign out) collapses behind one avatar+name button that opens a menu,
// so the header stays uncluttered no matter how many actions live here.
export function AuthWidget({
  className,
  hideProfileLink,
  hideSettingsLink,
}: {
  className?: string;
  hideProfileLink?: boolean;
  hideSettingsLink?: boolean;
}) {
  const { user, isLoading, openAuthModal, signOut } = useAuth();
  const { resolvedTheme, setPreference } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (isLoading) {
    return null;
  }

  if (user) {
    const name = getDisplayName(user);
    const initial = name.trim().charAt(0).toUpperCase() || "?";
    const itemClass =
      "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:bg-black/[0.06] dark:text-zinc-200 dark:hover:bg-white/10";

    return (
      <div ref={containerRef} className={`relative ${className ?? ""}`}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className="flex items-center gap-2 rounded-full border border-black/15 py-1 pl-1 pr-2.5 text-sm font-semibold text-zinc-800 transition hover:border-accent dark:border-white/20 dark:text-zinc-200 sm:pr-3"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-black text-accent-fg">
            {initial}
          </span>
          <span className="hidden max-w-[9rem] truncate sm:inline">{name}</span>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {isOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-lg border border-black/10 bg-white py-1 shadow-xl dark:border-white/15 dark:bg-[#0b1a29]"
          >
            <p className="truncate px-4 pb-2 pt-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {name}
            </p>
            <div className="border-t border-black/10 dark:border-white/10" />

            {hideProfileLink ? null : (
              <Link href="/profile" role="menuitem" className={itemClass} onClick={() => setIsOpen(false)}>
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Profile
              </Link>
            )}

            {hideSettingsLink ? null : (
              <Link href="/settings" role="menuitem" className={itemClass} onClick={() => setIsOpen(false)}>
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </Link>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => setPreference(isDark ? "light" : "dark")}
              className={itemClass}
            >
              {isDark ? (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
              {isDark ? "Light mode" : "Dark mode"}
            </button>

            <div className="border-t border-black/10 dark:border-white/10" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                signOut();
              }}
              className={itemClass}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Log out
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <button
        type="button"
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        title={`Switch to ${isDark ? "light" : "dark"} mode`}
        onClick={() => setPreference(isDark ? "light" : "dark")}
        className="flex items-center rounded border border-black/15 p-1.5 text-zinc-800 transition hover:border-accent hover:text-accent-hover dark:border-white/20 dark:text-zinc-200 dark:hover:text-accent-hover"
      >
        {isDark ? (
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
      </button>
      <button
        type="button"
        onClick={() => openAuthModal("sign-in")}
        className="rounded border border-accent px-3 py-1.5 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg"
      >
        Log in
      </button>
    </div>
  );
}
