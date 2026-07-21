"use client";

import Link from "next/link";
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
      <div className={`flex items-center gap-3 text-sm ${className ?? ""}`}>
        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{getDisplayName(user)}</span>
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
        {hideProfileLink ? null : (
          <Link
            href="/profile"
            className="rounded border border-black/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover dark:border-white/20 dark:text-zinc-200 dark:hover:text-accent-hover"
          >
            Profile
          </Link>
        )}
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded border border-black/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover dark:border-white/20 dark:text-zinc-200 dark:hover:text-accent-hover"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openAuthModal("sign-in")}
      className={`rounded border border-accent px-3 py-1.5 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg ${className ?? ""}`}
    >
      Log in
    </button>
  );
}
