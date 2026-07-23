"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

// Shown on /admin (and /admin/reps) when nobody is signed in. Admin and rep
// powers now ride on the single main-site session, so there is no separate
// admin login: this just points the visitor at the site's normal sign-in,
// which supports email/password AND Google/GitHub. Once they're signed in, the
// page re-renders and shows the console (or "not authorized" if their account
// has no powers).
export function AdminLoginForm() {
  const { openAuthModal } = useAuth();

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="rounded-2xl border border-black/10 bg-white p-6 text-center shadow-2xl shadow-black/50 dark:border-white/10 dark:bg-[#0b1a2b]">
        <h1 className="text-lg font-black text-zinc-900 dark:text-white">Sign in to continue</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Admin and team-rep tools use your normal Bobble Shelf account. Sign in and your access
          appears automatically.
        </p>
        <button
          type="button"
          onClick={() => openAuthModal("sign-in")}
          className="mt-4 w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover"
        >
          Sign in
        </button>
      </div>
      <Link href="/" className="mt-4 block text-center text-xs font-bold text-accent hover:text-accent-hover">
        ← Back to Bobble Shelf
      </Link>
    </div>
  );
}
