"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { useAdminAuth } from "@/lib/adminAuth";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white ring-2 ring-[#15110d]">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function AdminPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [pendingSubmissions, setPendingSubmissions] = useState(0);
  const [pendingReports, setPendingReports] = useState(0);
  const [openDeadImages, setOpenDeadImages] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

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

    supabase
      .from("dead_images")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .then(({ count }) => {
        if (!cancelled) setOpenDeadImages(count ?? 0);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (isLoading) {
    return null;
  }

  if (!user) {
    return (
      <main className="min-h-full bg-[#15110d] px-4 py-10 text-zinc-100">
        <AdminLoginForm />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-full bg-[#15110d] px-4 py-10 text-center text-zinc-100">
        <p className="text-sm font-black uppercase tracking-wide text-zinc-100">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-400">{user.email} isn&apos;t an approved admin account.</p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 rounded border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
        >
          Log out
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#15110d] px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wide">Admin mode</h1>
            <p className="mt-1 text-sm text-zinc-400">Signed in as {user.email}</p>
            <Link
              href="/"
              className="mt-2 inline-block text-xs font-bold text-amber-300 hover:text-amber-200"
            >
              ← Back to Bobbleshelf
            </Link>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded border border-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
          >
            Log out
          </button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/admin/review"
            className="relative rounded-lg border border-white/10 bg-[#0b1a29] p-5 transition hover:border-amber-400/60"
          >
            <NotificationBadge count={pendingSubmissions} />
            <p className="text-sm font-black uppercase tracking-wide text-white">Review submissions</p>
            <p className="mt-2 text-sm text-zinc-400">Approve or deny pending photo and bobblehead submissions.</p>
          </Link>
          <Link
            href="/admin/reports"
            className="relative rounded-lg border border-white/10 bg-[#0b1a29] p-5 transition hover:border-amber-400/60"
          >
            <NotificationBadge count={pendingReports} />
            <p className="text-sm font-black uppercase tracking-wide text-white">Listing reports</p>
            <p className="mt-2 text-sm text-zinc-400">Resolve or dismiss reports that a listing has wrong info.</p>
          </Link>
          <Link
            href="/admin/dead-images"
            className="relative rounded-lg border border-white/10 bg-[#0b1a29] p-5 transition hover:border-amber-400/60"
          >
            <NotificationBadge count={openDeadImages} />
            <p className="text-sm font-black uppercase tracking-wide text-white">Dead images</p>
            <p className="mt-2 text-sm text-zinc-400">Fix listing photos the nightly sweep couldn&apos;t load.</p>
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-white/10 bg-[#0b1a29] p-5 transition hover:border-amber-400/60"
          >
            <p className="text-sm font-black uppercase tracking-wide text-white">Edit bobbleheads</p>
            <p className="mt-2 text-sm text-zinc-400">
              Browse to any team or bobblehead page — an Edit button now appears there.
            </p>
          </Link>
          <Link
            href="/admin/users"
            className="rounded-lg border border-white/10 bg-[#0b1a29] p-5 transition hover:border-amber-400/60"
          >
            <p className="text-sm font-black uppercase tracking-wide text-white">Manage users</p>
            <p className="mt-2 text-sm text-zinc-400">Review every account, edit display names, or remove a user.</p>
          </Link>
          <Link
            href="/admin/users"
            className="rounded-lg border border-white/10 bg-[#0b1a29] p-5 transition hover:border-amber-400/60"
          >
            <p className="text-sm font-black uppercase tracking-wide text-white">Email users</p>
            <p className="mt-2 text-sm text-zinc-400">Message one user, a selected group, or everyone at once.</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
