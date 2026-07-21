"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import type { AdminCollectionItem } from "@/lib/adminCollections";
import { getTeamBySlug } from "@/lib/teams";

const teamName = (slug: string) => getTeamBySlug(slug)?.name ?? slug;

// Shared screen for the admin "browse a collection type site-wide" pages
// (owned / wanted / favorited / community listings / gallery photos). It owns
// the admin auth gate, header, search box, and card grid so each route file is
// just a data hook plus copy. `variant` switches between a compact listing card
// and a photo-forward card for the gallery.
export function AdminItemsBrowser({
  title,
  description,
  items,
  isLoading,
  error,
  noun,
  variant = "listing",
}: {
  title: string;
  description: string;
  items: AdminCollectionItem[];
  isLoading: boolean;
  error: string | null;
  noun: string;
  variant?: "listing" | "photo";
}) {
  const { user, isAdmin, isLoading: isAuthLoading, signOut } = useAdminAuth();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      `${item.title} ${teamName(item.teamSlug)} ${item.teamSlug} ${item.owner?.name ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [items, query]);

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
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div>
          <Link
            href="/admin/stats"
            className="text-sm font-black uppercase tracking-wide text-white hover:text-amber-300"
          >
            ← Back to stats
          </Link>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">{title}</h1>
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
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
        <p className="mx-auto mt-6 max-w-5xl text-sm font-semibold text-red-400">{error}</p>
      ) : null}

      <div className="mx-auto max-w-5xl">
        {!isLoading && items.length > 0 ? (
          <div className="mt-6 flex items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search by team, bobblehead${
                items.some((item) => item.owner) ? ", or collector" : ""
              }…`}
              className="w-full max-w-sm rounded-lg border border-white/15 bg-[#0b1a29] px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
            />
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {filtered.length} of {items.length} {noun}
            </span>
          </div>
        ) : null}

        {isLoading ? (
          <p className="mt-8 text-sm text-zinc-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-400">No {noun} yet.</p>
        ) : filtered.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-400">No {noun} match your search.</p>
        ) : (
          <ul
            className={
              variant === "photo"
                ? "mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                : "mt-6 grid gap-3 sm:grid-cols-2"
            }
          >
            {filtered.map((item) => (
              <li
                key={item.key}
                className="overflow-hidden rounded-lg border border-white/10 bg-[#0b1a29]"
              >
                <Link href={item.href} className="flex gap-3 p-3 transition hover:bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl ?? undefined}
                    alt=""
                    className={`shrink-0 rounded bg-black/30 object-cover ${
                      variant === "photo" ? "h-24 w-24" : "h-14 w-14"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-white">{item.title}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-wide text-amber-300">
                      {teamName(item.teamSlug)}
                    </p>
                    {item.owner ? (
                      <p className="mt-1 truncate text-xs text-zinc-400">{item.owner.name}</p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
