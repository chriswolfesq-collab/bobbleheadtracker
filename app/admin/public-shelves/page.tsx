"use client";

import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
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
      <main className="min-h-full bg-slate-50 px-4 py-10 text-center text-zinc-900">
        <p className="text-sm font-black uppercase tracking-wide text-zinc-900">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-600">Log in with an admin-mode account to continue.</p>
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
    <main className="min-h-full bg-slate-50 px-4 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { href: "/", label: "Home" },
              { href: "/admin", label: "Admin" },
              { href: "/admin/stats", label: "Site stats" },
              { label: "Public shelves" },
            ]}
          />
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">Public shelves</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Collectors who have made their shelf public. Each opens their shared /shelf page.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-zinc-800">{user.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded border border-black/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover"
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
          <p className="mt-8 text-sm text-zinc-600">Loading…</p>
        ) : shelves.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-600">No public shelves yet.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {shelves.map((shelf) => (
              <li
                key={shelf.id}
                className="rounded-lg border border-black/10 bg-white"
              >
                <Link
                  href={`/shelf/${shelf.slug}`}
                  className="flex items-center justify-between gap-3 p-4 transition hover:bg-black/[0.04]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-black text-zinc-900">{shelf.displayName}</span>
                    <span className="block truncate text-xs text-zinc-600">/shelf/{shelf.slug}</span>
                  </span>
                  <span aria-hidden className="shrink-0 text-accent">
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
