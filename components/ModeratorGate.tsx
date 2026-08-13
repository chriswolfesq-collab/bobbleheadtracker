"use client";

import { AdminLoginForm } from "@/components/AdminLoginForm";
import { useAdminAuth } from "@/lib/adminAuth";

// The sign-in / not-authorized wrapper the forum pages share. The rest of the
// admin console inlines this same three-branch check per page, which is fine
// when the branches differ (Messages is admin-only, Review is not) — but the
// board and a thread on it ask exactly the same question, and the answer has to
// match the RLS in supabase/mod_forum.sql: admins and reps of any team.
//
// The gate is a courtesy, not the enforcement. Every read here goes through a
// SECURITY DEFINER RPC that checks is_moderator() for itself, so a signed-in
// non-moderator who routes around this sees an empty board, not a private one.
export function ModeratorGate({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isRep, isLoading, signOut } = useAdminAuth();

  if (isLoading) return null;

  if (!user) {
    return (
      <main className="min-h-full bg-slate-50 px-4 py-10 text-zinc-900">
        <AdminLoginForm />
      </main>
    );
  }

  if (!isAdmin && !isRep) {
    return (
      <main className="min-h-full bg-slate-50 px-4 py-10 text-center text-zinc-900">
        <p className="text-sm font-black uppercase tracking-wide">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-600">
          The Team Rep Forum is for admins and team reps.
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 rounded border border-black/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover"
        >
          Log out
        </button>
      </main>
    );
  }

  return <>{children}</>;
}
