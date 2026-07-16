"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

type Report = {
  id: string;
  team_slug: string;
  bobblehead_id: string;
  source: "curated" | "community";
  title: string;
  reason: "not_real" | "wrong_date" | "wrong_name" | "other";
  details: string | null;
  submitted_by: string;
  created_at: string;
};

const REASON_LABELS: Record<Report["reason"], string> = {
  not_real: "Not a real listing",
  wrong_date: "Incorrect date",
  wrong_name: "Incorrect name",
  other: "Other",
};

export default function AdminReportsPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [rows, setRows] = useState<Report[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    supabase
      .from("listing_reports")
      .select("id, team_slug, bobblehead_id, source, title, reason, details, submitted_by, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;

        if (fetchError) {
          setError(fetchError.message);
        } else {
          setRows((data ?? []) as Report[]);
        }
        setIsLoadingRows(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const updateStatus = async (report: Report, status: "resolved" | "dismissed") => {
    setBusyId(report.id);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("listing_reports")
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq("id", report.id);

      if (updateError) throw new Error(updateError.message);

      setRows((current) => current.filter((row) => row.id !== report.id));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update report.");
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
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">Listing reports</h1>
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
          <p className="text-sm text-zinc-400">No open reports.</p>
        ) : (
          rows.map((row) => {
            const href =
              row.source === "community"
                ? `/teams/${row.team_slug}/community?id=${encodeURIComponent(row.bobblehead_id)}`
                : `/teams/${row.team_slug}/bobbleheads/${row.bobblehead_id}`;

            return (
              <div
                key={row.id}
                className="grid gap-4 rounded-lg border border-white/10 bg-[#0b1a29] p-4 sm:grid-cols-[1fr_auto]"
              >
                <div className="text-sm">
                  <p className="font-black uppercase tracking-wide text-amber-300">{REASON_LABELS[row.reason]}</p>
                  <p className="mt-1 text-zinc-200">
                    Team: <span className="font-semibold">{row.team_slug}</span>
                  </p>
                  <p className="text-zinc-200">
                    Listing:{" "}
                    <Link href={href} className="font-semibold underline hover:text-amber-300">
                      {row.title}
                    </Link>
                  </p>
                  {row.details ? <p className="mt-2 text-zinc-300">{row.details}</p> : null}
                  <p className="mt-1 text-xs text-zinc-500">Reported {new Date(row.created_at).toLocaleString()}</p>
                </div>

                <div className="flex flex-col justify-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => updateStatus(row, "resolved")}
                    className="rounded bg-amber-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300 disabled:opacity-60"
                  >
                    Mark resolved
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => updateStatus(row, "dismissed")}
                    className="rounded border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-red-400 hover:text-red-300 disabled:opacity-60"
                  >
                    Dismiss
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
