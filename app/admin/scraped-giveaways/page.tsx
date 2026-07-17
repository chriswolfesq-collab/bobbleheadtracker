"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

type ScrapedGiveawayRow = {
  id: string;
  team_slug: string;
  title: string;
  year: string;
  date: string;
  source_url: string;
  detected_text: string | null;
  first_seen_at: string;
};

export default function AdminScrapedGiveawaysPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [rows, setRows] = useState<ScrapedGiveawayRow[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    supabase
      .from("scraped_giveaways")
      .select("id, team_slug, title, year, date, source_url, detected_text, first_seen_at")
      .eq("status", "pending")
      .order("first_seen_at", { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;

        if (fetchError) {
          setError(fetchError.message);
        } else {
          setRows((data ?? []) as ScrapedGiveawayRow[]);
        }
        setIsLoadingRows(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const approve = async (row: ScrapedGiveawayRow) => {
    setBusyId(row.id);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc("approve_scraped_giveaway", { p_id: row.id });
      if (rpcError) throw new Error(rpcError.message);
      setRows((current) => current.filter((r) => r.id !== row.id));
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Could not approve draft.");
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (row: ScrapedGiveawayRow) => {
    setBusyId(row.id);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("scraped_giveaways")
        .update({ status: "dismissed", reviewed_at: new Date().toISOString() })
        .eq("id", row.id);

      if (updateError) throw new Error(updateError.message);
      setRows((current) => current.filter((r) => r.id !== row.id));
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : "Could not dismiss draft.");
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
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">New giveaways</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Bobblehead promos the scraper found on team schedule pages. Approve to publish one as a
            listing, or dismiss it.
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
          <p className="text-sm text-zinc-400">
            No new giveaways to review. The scraper drafts them here as it finds them.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-4 rounded-lg border border-white/10 bg-[#0b1a29] p-4 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0 text-sm">
                <p className="text-lg font-black tracking-wide text-white">{row.title}</p>
                <p className="mt-1 text-zinc-200">
                  Team: <span className="font-semibold">{row.team_slug}</span> · {row.date}
                  {row.year && !row.date.includes(row.year) ? ` (${row.year})` : ""}
                </p>
                {row.detected_text ? (
                  <p className="mt-2 rounded bg-black/30 px-2 py-1 text-xs italic text-zinc-400">
                    “{row.detected_text}”
                  </p>
                ) : null}
                <a
                  href={row.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block truncate text-xs text-zinc-400 underline hover:text-amber-300"
                >
                  {row.source_url}
                </a>
                <p className="mt-1 text-xs text-zinc-500">
                  First seen {new Date(row.first_seen_at).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-col justify-center gap-2">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => approve(row)}
                  className="rounded bg-amber-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => dismiss(row)}
                  className="rounded border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-red-400 hover:text-red-300 disabled:opacity-60"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
