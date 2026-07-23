"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { useAdminAuth } from "@/lib/adminAuth";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { TEAMS } from "@/lib/teams";

function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white ring-2 ring-slate-50 dark:ring-[#15110d]">
      {count > 99 ? "99+" : count}
    </span>
  );
}

const teamName = (slug: string) => TEAMS.find((t) => t.slug === slug)?.name ?? slug;

export default function AdminPage() {
  const { user, isAdmin, isRep, editableTeams, isLoading, signOut } = useAdminAuth();
  const canAccess = isAdmin || isRep;
  const [pendingSubmissions, setPendingSubmissions] = useState(0);
  const [pendingReports, setPendingReports] = useState(0);
  const [openDeadImages, setOpenDeadImages] = useState(0);
  const [pendingScraped, setPendingScraped] = useState(0);

  useEffect(() => {
    if (!canAccess) return;

    let cancelled = false;

    // These two are team-scoped by RLS, so a rep sees the count for their team
    // only; a full admin sees the site-wide count. Same query either way.
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => {
        if (!cancelled) setPendingSubmissions(count ?? 0);
      });

    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => {
        if (!cancelled) setPendingReports(count ?? 0);
      });

    // Dead images and scraped giveaways are site-wide tools, admin-only, so
    // only fetch their counts when the tiles will actually be shown.
    if (isAdmin) {
      supabase
        .from("dead_images")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .then(({ count }) => {
          if (!cancelled) setOpenDeadImages(count ?? 0);
        });

      supabase
        .from("scraped_giveaways")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .then(({ count }) => {
          if (!cancelled) setPendingScraped(count ?? 0);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [canAccess, isAdmin]);

  if (isLoading) {
    return null;
  }

  if (!user) {
    return (
      <main className="min-h-full bg-slate-50 dark:bg-[#15110d] px-4 py-10 text-zinc-900 dark:text-zinc-100">
        <AdminLoginForm />
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="min-h-full bg-slate-50 dark:bg-[#15110d] px-4 py-10 text-center text-zinc-900 dark:text-zinc-100">
        <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{user.email} isn&apos;t an approved admin or team-rep account.</p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 rounded border border-black/15 dark:border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-accent hover:text-accent-hover dark:hover:text-accent-hover"
        >
          Log out
        </button>
      </main>
    );
  }

  const cardClass =
    "relative rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#0b1a29] p-5 transition hover:border-accent/60";

  return (
    <main className="min-h-full bg-slate-50 dark:bg-[#15110d] px-4 py-10 text-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wide">
              {isAdmin ? "Admin mode" : "Team rep mode"}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Signed in as {user.email}</p>
            {isRep ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                You can edit{" "}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {editableTeams.map(teamName).join(", ")}
                </span>
                .
              </p>
            ) : null}
            <Link
              href="/"
              className="mt-2 inline-block text-xs font-bold text-accent hover:text-accent-hover dark:hover:text-accent-hover"
            >
              ← Back to Bobble Shelf
            </Link>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded border border-black/15 dark:border-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-accent hover:text-accent-hover dark:hover:text-accent-hover"
          >
            Log out
          </button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {/* Reps get direct links to their team page(s); admins edit any team
              by browsing to it (the generic tile below). */}
          {isRep
            ? editableTeams.map((slug) => (
                <Link key={slug} href={`/teams/${slug}`} className={cardClass}>
                  <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white">
                    Edit {teamName(slug)} page
                  </p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Open your team page — Edit buttons appear on each bobblehead.
                  </p>
                </Link>
              ))
            : null}

          <Link href="/admin/review" className={cardClass}>
            <NotificationBadge count={pendingSubmissions} />
            <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white">Review submissions</p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Approve or deny pending photo and bobblehead submissions{isRep ? " for your team" : ""}.
            </p>
          </Link>
          <Link href="/admin/reports" className={cardClass}>
            <NotificationBadge count={pendingReports} />
            <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white">Listing reports</p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Resolve or dismiss reports that a listing has wrong info{isRep ? " for your team" : ""}.
            </p>
          </Link>

          {isAdmin ? (
            <>
              <Link href="/admin/dead-images" className={cardClass}>
                <NotificationBadge count={openDeadImages} />
                <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white">Dead images</p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Fix listing photos the nightly sweep couldn&apos;t load.</p>
              </Link>
              <Link href="/admin/scraped-giveaways" className={cardClass}>
                <NotificationBadge count={pendingScraped} />
                <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white">New giveaways</p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Review bobblehead promos the scraper found on team schedule pages.</p>
              </Link>
              <Link href="/" className={cardClass}>
                <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white">Edit bobbleheads</p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Browse to any team or bobblehead page — an Edit button now appears there.
                </p>
              </Link>
              <Link href="/admin/reps" className={cardClass}>
                <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white">Manage reps</p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Give a person edit access to one team&apos;s page, or remove it.
                </p>
              </Link>
              <Link href="/admin/users" className={cardClass}>
                <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white">Manage users</p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Review every account, edit display names, remove a user, or email one, a group, or
                  everyone.
                </p>
              </Link>
              <Link href="/admin/stats" className={cardClass}>
                <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white">Site stats</p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">User growth, collection totals, queue throughput, and top teams.</p>
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
