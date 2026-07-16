"use client";

import Link from "next/link";
import { getDisplayName, useAuth } from "@/lib/auth";

export function AuthWidget({ className, hideProfileLink }: { className?: string; hideProfileLink?: boolean }) {
  const { user, isLoading, openAuthModal, signOut } = useAuth();

  if (isLoading) {
    return null;
  }

  if (user) {
    return (
      <div className={`flex items-center gap-3 text-sm ${className ?? ""}`}>
        <span className="font-semibold text-zinc-200">{getDisplayName(user)}</span>
        {hideProfileLink ? null : (
          <Link
            href="/profile"
            className="rounded border border-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
          >
            Profile
          </Link>
        )}
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded border border-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
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
      className={`rounded border border-amber-400 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-[#07111d] ${className ?? ""}`}
    >
      Log in
    </button>
  );
}
