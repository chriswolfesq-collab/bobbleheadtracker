"use client";

import Link from "next/link";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { getDisplayName, useAuth } from "@/lib/auth";

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

  if (isLoading) {
    return null;
  }

  if (user) {
    return (
      <div className={`flex items-center gap-2 text-sm sm:gap-3 ${className ?? ""}`}>
        <span className="hidden font-semibold text-zinc-800 sm:inline dark:text-zinc-200">
          {getDisplayName(user)}
        </span>
        <ThemeToggleButton />
        {hideProfileLink ? null : (
          <Link
            href="/profile"
            aria-label="Profile"
            title="Profile"
            className="flex items-center gap-1.5 rounded border border-black/15 px-2 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover sm:px-3 dark:border-white/20 dark:text-zinc-200 dark:hover:text-accent-hover"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 sm:hidden"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="hidden sm:inline">Profile</span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => signOut()}
          aria-label="Log out"
          title="Log out"
          className="flex items-center gap-1.5 rounded border border-black/15 px-2 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover sm:px-3 dark:border-white/20 dark:text-zinc-200 dark:hover:text-accent-hover"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 sm:hidden"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          <span className="hidden sm:inline">Log out</span>
        </button>
        {hideSettingsLink ? null : (
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            className="flex items-center rounded border border-black/15 px-2 py-1.5 text-zinc-800 transition hover:border-accent hover:text-accent-hover dark:border-white/20 dark:text-zinc-200 dark:hover:text-accent-hover"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <ThemeToggleButton />
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
