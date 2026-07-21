"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileSections } from "@/components/ProfileSections";
import { useAdminAuth } from "@/lib/adminAuth";
import {
  useCollectionSummary,
  useMyFavorites,
  useMySubmissions,
  useMyWanted,
  useSiteBobbleheadCounts,
} from "@/lib/profile";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

type ProfileUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

const BACK_LINKS: Record<string, { href: string; label: string }> = {
  users: { href: "/admin/users", label: "Back to users" },
  review: { href: "/admin/review", label: "Back to review" },
  reports: { href: "/admin/reports", label: "Back to reports" },
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Never";
}

export function AdminUserProfile() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const searchParams = useSearchParams();
  // Empty string when absent so the profile hooks below treat it as "no user"
  // and fetch nothing, rather than falling back to the admin's own session.
  const targetId = searchParams.get("id") ?? "";
  const backTo = BACK_LINKS[searchParams.get("from") ?? ""] ?? BACK_LINKS.users;

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Read this user's data through the admin client + explicit id, allowed by
  // the "…: admin select" RLS policies. Same hooks the user's own profile uses.
  const source = { userId: targetId, client: supabase };
  const { countByTeamSlug, totalOwned, isLoading: isCollectionLoading } = useCollectionSummary(source);
  const { totalByTeamSlug, siteTotal, isLoading: isSiteTotalLoading } = useSiteBobbleheadCounts();
  const { submissions, isLoading: isSubmissionsLoading } = useMySubmissions(source);
  const { favorites, isLoading: isFavoritesLoading } = useMyFavorites(source);
  const { wanted, isLoading: isWantedLoading } = useMyWanted(source);

  useEffect(() => {
    if (!isAdmin || !targetId) return;

    let cancelled = false;

    supabase.rpc("admin_get_user", { p_user_id: targetId }).then(({ data, error }) => {
      if (cancelled) return;

      if (error) {
        setProfileError(error.message);
      } else {
        setProfile(((data ?? [])[0] as ProfileUser) ?? null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, targetId]);

  if (isLoading) {
    return null;
  }

  if (!user || !isAdmin) {
    return (
      <main className="min-h-full bg-slate-50 dark:bg-[#15110d] px-4 py-10 text-center text-zinc-900 dark:text-zinc-100">
        <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Log in with an admin-mode account to continue.</p>
        <Link
          href="/admin"
          className="mt-6 inline-block rounded border border-accent px-4 py-2 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg"
        >
          Go to admin login
        </Link>
      </main>
    );
  }

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      <div className="flex items-center justify-between px-4 pt-4 sm:px-6">
        <Link
          href={backTo.href}
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:text-accent-hover dark:hover:text-accent-hover"
        >
          <span aria-hidden>←</span> {backTo.label}
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{user.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded border border-black/15 dark:border-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-accent hover:text-accent-hover dark:hover:text-accent-hover"
          >
            Log out
          </button>
        </div>
      </div>

      {!targetId ? (
        <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 pb-24 text-center">
          <h1 className="text-lg font-black text-zinc-900 dark:text-white">No user selected</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Pick a user from the users list to view their profile.</p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-2 sm:px-6">
          <header className="mb-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent/80 sm:text-xs">
              Viewing profile
            </p>
            <p className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">
              {profile?.display_name ?? "(no display name)"}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{profile?.email}</p>
            {profileError ? (
              <p className="mt-1 text-xs font-semibold text-red-400">{profileError}</p>
            ) : null}
            <p className="mt-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              {isCollectionLoading || isSiteTotalLoading
                ? "Loading…"
                : `${totalOwned}/${siteTotal} bobbleheads owned`}
            </p>
            {profile ? (
              <p className="mt-1 text-xs text-zinc-500">
                Joined {formatDate(profile.created_at)} · Last sign-in{" "}
                {formatDate(profile.last_sign_in_at)}
              </p>
            ) : null}
          </header>

          <ProfileSections
            countByTeamSlug={countByTeamSlug}
            totalByTeamSlug={totalByTeamSlug}
            favorites={favorites}
            isFavoritesLoading={isFavoritesLoading}
            wanted={wanted}
            isWantedLoading={isWantedLoading}
            submissions={submissions}
            isSubmissionsLoading={isSubmissionsLoading}
            isOtherUser
          />
        </div>
      )}
    </div>
  );
}
