"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminEmailComposer, type EmailTarget } from "@/components/AdminEmailComposer";
import { AdminFilterBar } from "@/components/AdminFilterBar";
import { BulkPrimaryButton, BulkSecondaryButton, BulkSelectBar } from "@/components/BulkSelectBar";
import { useAdminAuth } from "@/lib/adminAuth";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { type AdminFilter, useAdminFilters } from "@/lib/useAdminFilters";
import { useBulkRunner } from "@/lib/useBulkRunner";
import { useBulkSelection } from "@/lib/useBulkSelection";

type Report = {
  id: string;
  team_slug: string;
  bobblehead_id: string;
  source: "curated" | "community";
  title: string;
  reason: "not_real" | "wrong_date" | "wrong_name" | "duplicate" | "other";
  details: string | null;
  submitted_by: string;
  created_at: string;
};

const REASON_LABELS: Record<Report["reason"], string> = {
  not_real: "Not a real listing",
  wrong_date: "Incorrect date",
  wrong_name: "Incorrect name",
  duplicate: "Duplicate listing",
  other: "Other",
};

const searchReport = (row: Report) => `${row.team_slug} ${row.title} ${row.details ?? ""}`;

const REPORT_FILTERS: AdminFilter<Report>[] = [
  {
    id: "reason",
    allLabel: "All reasons",
    get: (row) => row.reason,
    options: (Object.keys(REASON_LABELS) as Report["reason"][]).map((reason) => ({
      value: reason,
      label: REASON_LABELS[reason],
    })),
  },
  {
    id: "source",
    allLabel: "All sources",
    get: (row) => row.source,
    options: [
      { value: "curated", label: "Curated" },
      { value: "community", label: "Community" },
    ],
  },
];

export default function AdminReportsPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [rows, setRows] = useState<Report[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<EmailTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filter = useAdminFilters(rows, searchReport, REPORT_FILTERS);
  const filtered = filter.filtered;
  const selection = useBulkSelection(filtered.map((row) => row.id));
  const bulk = useBulkRunner<Report>();

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

  const setReportStatus = async (report: Report, status: "resolved" | "dismissed") => {
    const { error: updateError } = await supabase
      .from("listing_reports")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", report.id);

    if (updateError) throw new Error(updateError.message);
  };

  const updateStatus = async (report: Report, status: "resolved" | "dismissed") => {
    setBusyId(report.id);
    setError(null);

    try {
      await setReportStatus(report, status);
      setRows((current) => current.filter((row) => row.id !== report.id));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update report.");
    } finally {
      setBusyId(null);
    }
  };

  // The report row only carries the reporter's user id, so resolve their
  // email/name (same RPC the profile view uses) before opening the composer.
  const messageSubmitter = async (userId: string) => {
    setMessagingId(userId);
    setError(null);
    try {
      const { data, error: lookupError } = await supabase.rpc("admin_get_user", { p_user_id: userId });
      if (lookupError) throw new Error(lookupError.message);
      const profile = (data ?? [])[0] as { email: string | null; display_name: string | null } | undefined;
      setEmailTarget({
        kind: "selected",
        recipients: [{ id: userId, email: profile?.email ?? null, name: profile?.display_name ?? null }],
      });
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Could not look up the reporter.");
    } finally {
      setMessagingId(null);
    }
  };

  const runBulkAction = async (status: "resolved" | "dismissed", verb: string) => {
    const targets = filtered.filter((row) => selection.isSelected(row.id));
    if (targets.length === 0) return;
    setError(null);

    const { succeeded, failed } = await bulk.run(targets, (report) => setReportStatus(report, status));
    const okIds = new Set(succeeded.map((row) => row.id));
    setRows((current) => current.filter((row) => !okIds.has(row.id)));
    selection.clear();

    if (failed.length) {
      setError(`Couldn't ${verb} ${failed.length} of ${targets.length}: ${failed[0].error}`);
    }
  };

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
    <main className="min-h-full bg-slate-50 dark:bg-[#15110d] px-4 py-8 text-zinc-900 dark:text-zinc-100 sm:px-8">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white hover:text-accent-hover dark:hover:text-accent-hover">
            ← Back to admin
          </Link>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">Listing reports</h1>
        </div>
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

      {error ? <p className="mx-auto mt-4 max-w-4xl text-sm font-semibold text-red-400">{error}</p> : null}
      {notice ? <p className="mx-auto mt-4 max-w-4xl text-sm font-semibold text-accent">{notice}</p> : null}

      {!isLoadingRows && rows.length > 0 ? (
        <div className="mt-6">
          <AdminFilterBar
            filters={REPORT_FILTERS}
            state={filter}
            placeholder="Search by team, listing, or details…"
            total={rows.length}
            noun="reports"
          />
        </div>
      ) : null}

      {!isLoadingRows && filtered.length > 0 ? (
        <div className="mt-6">
          <BulkSelectBar
            total={filtered.length}
            count={selection.count}
            allSelected={selection.allSelected}
            onToggleAll={selection.toggleAll}
            busy={bulk.busy}
            progress={bulk.progress}
          >
            <BulkPrimaryButton
              onClick={() => runBulkAction("resolved", "resolve")}
              disabled={!selection.someSelected || bulk.busy}
            >
              Mark resolved
            </BulkPrimaryButton>
            <BulkSecondaryButton
              onClick={() => runBulkAction("dismissed", "dismiss")}
              disabled={!selection.someSelected || bulk.busy}
            >
              Dismiss
            </BulkSecondaryButton>
          </BulkSelectBar>
        </div>
      ) : null}

      <div className="mx-auto mt-6 max-w-4xl space-y-4">
        {isLoadingRows ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No open reports.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No reports match your search.</p>
        ) : (
          filtered.map((row) => {
            const href =
              row.source === "community"
                ? `/teams/${row.team_slug}/community?id=${encodeURIComponent(row.bobblehead_id)}`
                : `/teams/${row.team_slug}/bobbleheads/${row.bobblehead_id}`;

            return (
              <div
                key={row.id}
                className={`grid gap-4 rounded-lg border bg-white dark:bg-[#0b1a29] p-4 sm:grid-cols-[auto_1fr_auto] ${
                  selection.isSelected(row.id) ? "border-accent/70 ring-1 ring-accent/40" : "border-black/10 dark:border-white/10"
                }`}
              >
                <label className="flex items-start justify-center pt-1 sm:items-center sm:pt-0">
                  <input
                    type="checkbox"
                    checked={selection.isSelected(row.id)}
                    onChange={() => selection.toggle(row.id)}
                    disabled={bulk.busy}
                    className="h-4 w-4 accent-accent"
                    aria-label="Select report"
                  />
                </label>

                <div className="text-sm">
                  <p className="font-black uppercase tracking-wide text-accent">{REASON_LABELS[row.reason]}</p>
                  <p className="mt-1 text-zinc-800 dark:text-zinc-200">
                    Team: <span className="font-semibold">{row.team_slug}</span>
                  </p>
                  <p className="text-zinc-800 dark:text-zinc-200">
                    Listing:{" "}
                    <Link href={href} className="font-semibold underline hover:text-accent-hover dark:hover:text-accent-hover">
                      {row.title}
                    </Link>
                  </p>
                  {row.details ? <p className="mt-2 text-zinc-700 dark:text-zinc-300">{row.details}</p> : null}
                  <p className="mt-1 text-xs text-zinc-500">Reported {new Date(row.created_at).toLocaleString()}</p>
                </div>

                <div className="flex flex-col justify-center gap-2">
                  <Link
                    href={`/admin/users/view?id=${encodeURIComponent(row.submitted_by)}&from=reports`}
                    className="rounded border border-black/15 dark:border-white/20 px-4 py-2 text-center text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-accent hover:text-accent-hover dark:hover:text-accent-hover"
                  >
                    View profile
                  </Link>
                  <button
                    type="button"
                    disabled={messagingId === row.submitted_by || bulk.busy}
                    onClick={() => messageSubmitter(row.submitted_by)}
                    className="rounded border border-black/15 dark:border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-accent hover:text-accent-hover dark:hover:text-accent-hover disabled:opacity-60"
                  >
                    {messagingId === row.submitted_by ? "Opening…" : "Message"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id || bulk.busy}
                    onClick={() => updateStatus(row, "resolved")}
                    className="rounded bg-accent px-4 py-2 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
                  >
                    Mark resolved
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id || bulk.busy}
                    onClick={() => updateStatus(row, "dismissed")}
                    className="rounded border border-black/15 dark:border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-red-400 hover:text-red-300 disabled:opacity-60"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {emailTarget ? (
        <AdminEmailComposer
          target={emailTarget}
          onClose={() => setEmailTarget(null)}
          onSent={(count) => {
            setEmailTarget(null);
            setError(null);
            setNotice(`Message sent to ${count} ${count === 1 ? "recipient" : "recipients"}.`);
          }}
        />
      ) : null}
    </main>
  );
}
