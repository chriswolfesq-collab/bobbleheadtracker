"use client";

import Link from "next/link";
import { useAdminAuth } from "@/lib/adminAuth";
import { useAdminPublicShelves } from "@/lib/adminCollections";

export default function AdminPublicShelvesPage() {
  const { user, isAdmin, isLoading: isAuthLoading, signOut } = useAdminAuth();
  const { shelves, isLoading, error } = useAdminPublicShelves();

  if (isAuthLoading) {
    return null;
  }

  if (!user || !isAdmin) {
    return (
      <main className="min-h-full bg-[#15110d] px-4 py-10 text-center text-zinc-100">
        <p className="text-sm font-black uppercase tracking-wide text-zinc-100">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-400">Log in with an admin-mode account to continue.</p>
        <Link
          href="/admin"
          className="mt-6 inline-block rounded border border-amber-400 px-4 py-2 text-xs font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-[#07111d]"
        >
          Go to admin login
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#15110d] px-4 py-8 text-zinc-100 sm:px-8">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <div>
          <Link
            href="/admin/stats"
            className="text-sm font-black uppercase tracking-wide text-white hover:text-amber-300"
          >
            ← Back to stats
          </Link>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">Public shelves</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Collectors who have made their shelf public. Each opens their shared /shelf page.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-zinc-200">{user.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded border border-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
          >
            Log out
          </button>
        </div>
      </div>

      {error ? (
        <p className="mx-auto mt-6 max-w-3xl text-sm font-semibold text-red-400">{error}</p>
      ) : null}

      <div className="mx-auto max-w-3xl">
        {isLoading ? (
          <p className="mt-8 text-sm text-zinc-400">Loading…</p>
        ) : shelves.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-400">No public shelves yet.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {shelves.map((shelf) => (
              <li
                key={shelf.id}
                className="rounded-lg border border-white/10 bg-[#0b1a29]"
              >
                <Link
                  href={`/shelf/${shelf.slug}`}
                  className="flex items-center justify-between gap-3 p-4 transition hover:bg-white/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-black text-white">{shelf.displayName}</span>
                    <span className="block truncate text-xs text-zinc-400">/shelf/{shelf.slug}</span>
                  </span>
                  <span aria-hidden className="shrink-0 text-amber-300">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
