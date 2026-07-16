"use client";

import Link from "next/link";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { useAdminAuth } from "@/lib/adminAuth";

export default function AdminPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();

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
            className="rounded-lg border border-white/10 bg-[#0b1a29] p-5 transition hover:border-amber-400/60"
          >
            <p className="text-sm font-black uppercase tracking-wide text-white">Review submissions</p>
            <p className="mt-2 text-sm text-zinc-400">Approve or deny pending photo and bobblehead submissions.</p>
          </Link>
          <Link
            href="/admin/reports"
            className="rounded-lg border border-white/10 bg-[#0b1a29] p-5 transition hover:border-amber-400/60"
          >
            <p className="text-sm font-black uppercase tracking-wide text-white">Listing reports</p>
            <p className="mt-2 text-sm text-zinc-400">Resolve or dismiss reports that a listing has wrong info.</p>
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
        </div>
      </div>
    </main>
  );
}
