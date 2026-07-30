"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getDisplayName, useAuth } from "@/lib/auth";

// A single account control. When signed in, everything (profile, settings,
// sign out) collapses behind one avatar+name button that opens a menu, so the
// header stays uncluttered no matter how many actions live here.
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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-black uppercase tracking-wide text-foreground transition hover:bg-black/[0.06]";

    return (
      <div ref={containerRef} className={`relative ${className ?? ""}`}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className="flex shrink-0 items-center gap-2 rounded-full border border-black/15 py-1 pl-1 pr-2.5 text-sm font-semibold text-foreground transition hover:border-accent sm:pr-3"
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
            className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-lg border border-border-soft bg-surface py-1 shadow-xl"
          >
            <p className="truncate px-4 pb-2 pt-1.5 text-xs font-semibold text-zinc-500">
              {name}
            </p>
            <div className="border-t border-border-soft" />

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
                My Shelf
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

            <div className="border-t border-border-soft" />
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
        onClick={() => openAuthModal("sign-in")}
        className="rounded border border-accent px-3 py-1.5 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent hover:text-accent-fg"
      >
        Sign In
      </button>
    </div>
  );
}
