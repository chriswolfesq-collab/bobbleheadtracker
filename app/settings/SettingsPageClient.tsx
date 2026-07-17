"use client";

import Link from "next/link";
import { AuthWidget } from "@/components/AuthWidget";
import { ShelfSharingToggle } from "@/components/ShelfSharingToggle";
import { useAuth } from "@/lib/auth";
import { useMyShelf } from "@/lib/profile";

export function SettingsPageClient() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const sharing = useMyShelf();

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, #1b2a4a 0%, #0e1626 45%, #090e1a 100%)",
      }}
    >
      <div className="flex items-center justify-between px-4 pt-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-300 transition hover:text-amber-300"
        >
          <span aria-hidden>←</span> Back to home
        </Link>
        <AuthWidget hideSettingsLink />
      </div>

      {isAuthLoading ? null : !user ? (
        <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 pb-24 text-center">
          <h1 className="text-lg font-black text-white">Sign in to see your settings</h1>
          <p className="text-sm text-zinc-400">
            Log in to manage your public shelf and other preferences.
          </p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-2 sm:px-6">
          <header className="mb-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-500/80 sm:text-xs">
              Settings
            </p>
          </header>

          <ShelfSharingToggle sharing={sharing} />
        </div>
      )}
    </div>
  );
}
