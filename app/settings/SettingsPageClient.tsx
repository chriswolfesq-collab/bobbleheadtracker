"use client";

import Link from "next/link";
import { AuthWidget } from "@/components/AuthWidget";
import { EmailAlertsToggle } from "@/components/EmailAlertsToggle";
import { GalleryToggle } from "@/components/GalleryToggle";
import { ShelfSharingToggle } from "@/components/ShelfSharingToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { useEmailAlerts, useGallerySharing, useMyShelf } from "@/lib/profile";

export function SettingsPageClient() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const sharing = useMyShelf();
  const gallery = useGallerySharing();
  const alerts = useEmailAlerts();

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      <div className="flex items-center justify-between px-4 pt-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 transition hover:text-accent-hover dark:text-zinc-300 dark:hover:text-accent-hover"
        >
          <span aria-hidden>←</span> Back to home
        </Link>
        <AuthWidget hideSettingsLink />
      </div>

      {isAuthLoading ? null : !user ? (
        <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 pb-24 text-center">
          <h1 className="text-lg font-black text-zinc-900 dark:text-white">Sign in to see your settings</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Log in to manage your public shelf and other preferences.
          </p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-2 sm:px-6">
          <header className="mb-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent/80 sm:text-xs">
              Settings
            </p>
          </header>

          <ThemeToggle />
          <ShelfSharingToggle sharing={sharing} />
          {/* The gallery only has an effect on a public shelf, so it appears as a
              sub-option: shown right under sharing, and only once sharing is on. */}
          {sharing.shelf.isPublic ? <GalleryToggle gallery={gallery} /> : null}
          <EmailAlertsToggle alerts={alerts} />
        </div>
      )}
    </div>
  );
}
