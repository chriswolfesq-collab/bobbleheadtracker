"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

type DeadImageRow = {
  id: string;
  source: "curated" | "approved_photo" | "community" | "gallery";
  listing_kind: "curated" | "community";
  team_slug: string;
  bobblehead_id: string;
  title: string | null;
  image_url: string;
  http_status: number | null;
  error: string | null;
  first_seen_at: string;
  last_checked_at: string;
};

const SOURCE_LABELS: Record<DeadImageRow["source"], string> = {
  curated: "Curated photo",
  approved_photo: "Main photo",
  community: "Community photo",
  gallery: "Gallery photo",
};

function reason(row: DeadImageRow): string {
  if (row.http_status != null) return `HTTP ${row.http_status}`;
  if (row.error === "timeout") return "Timed out";
  if (row.error === "network") return "Unreachable";
  return row.error ?? "Broken";
}

export default function AdminDeadImagesPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [rows, setRows] = useState<DeadImageRow[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    supabase
      .from("dead_images")
      .select(
        "id, source, listing_kind, team_slug, bobblehead_id, title, image_url, http_status, error, first_seen_at, last_checked_at",
      )
      .eq("status", "open")
      .order("first_seen_at", { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;

        if (fetchError) {
          setError(fetchError.message);
        } else {
          setRows((data ?? []) as DeadImageRow[]);
        }
        setIsLoadingRows(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const markFixed = async (row: DeadImageRow) => {
    setBusyId(row.id);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("dead_images")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", row.id);

      if (updateError) throw new Error(updateError.message);

      setRows((current) => current.filter((r) => r.id !== row.id));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update row.");
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
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
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm font-black uppercase tracking-wide text-white hover:text-amber-300">
            ← Back to admin
          </Link>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">Dead images</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Listing images the nightly sweep couldn&apos;t load. Fix the photo, then mark it fixed.
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

      {error ? <p className="mx-auto mt-4 max-w-4xl text-sm font-semibold text-red-400">{error}</p> : null}

      <div className="mx-auto mt-6 max-w-4xl space-y-4">
        {isLoadingRows ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-400">No dead images. Every listing photo loaded on the last sweep.</p>
        ) : (
          rows.map((row) => {
            const href =
              row.listing_kind === "community"
                ? `/teams/${row.team_slug}/community?id=${encodeURIComponent(row.bobblehead_id)}`
                : `/teams/${row.team_slug}/bobbleheads/${row.bobblehead_id}`;

            return (
              <div
                key={row.id}
                className="grid gap-4 rounded-lg border border-white/10 bg-[#0b1a29] p-4 sm:grid-cols-[auto_1fr_auto]"
              >
                {/* The broken image itself — a browser broken-image icon here is
                    a useful confirmation that the URL really doesn't load. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.image_url}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded bg-black/30 object-cover"
                />

                <div className="min-w-0 text-sm">
                  <p className="font-black uppercase tracking-wide text-amber-300">
                    {SOURCE_LABELS[row.source]} · {reason(row)}
                  </p>
                  <p className="mt-1 text-zinc-200">
                    Team: <span className="font-semibold">{row.team_slug}</span>
                  </p>
                  <p className="text-zinc-200">
                    Listing:{" "}
                    <Link href={href} className="font-semibold underline hover:text-amber-300">
                      {row.title ?? row.bobblehead_id}
                    </Link>
                  </p>
                  <a
                    href={row.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-xs text-zinc-400 underline hover:text-amber-300"
                  >
                    {row.image_url}
                  </a>
                  <p className="mt-1 text-xs text-zinc-500">
                    First seen {new Date(row.first_seen_at).toLocaleString()} · last checked{" "}
                    {new Date(row.last_checked_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-col justify-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => markFixed(row)}
                    className="rounded bg-amber-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300 disabled:opacity-60"
                  >
                    Mark fixed
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
