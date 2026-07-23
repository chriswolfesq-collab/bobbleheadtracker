"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminEmailComposer, type EmailTarget } from "@/components/AdminEmailComposer";
import { AdminFilterBar } from "@/components/AdminFilterBar";
import { BulkPrimaryButton, BulkSecondaryButton, BulkSelectBar } from "@/components/BulkSelectBar";
import { useAdminAuth } from "@/lib/adminAuth";
import { approveSubmission } from "@/lib/approveSubmission";
import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";
import { fetchBobbleheadOverrides } from "@/lib/bobbleheadOverrides";
import { findDuplicateBobblehead, type DuplicateCandidate } from "@/lib/duplicateCheck";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { type AdminFilter, useAdminFilters } from "@/lib/useAdminFilters";
import { useBulkRunner } from "@/lib/useBulkRunner";
import { useBulkSelection } from "@/lib/useBulkSelection";

type Submission = {
  id: string;
  kind: "photo_for_existing" | "new_bobblehead";
  target_bobblehead_id: string | null;
  team_slug: string;
  title: string | null;
  date: string | null;
  storage_path: string | null;
  submitted_by: string;
  created_at: string;
};

type ReviewRow = Submission & { signedUrl: string | null; duplicateOf: DuplicateCandidate | null };

const searchReview = (row: ReviewRow) =>
  `${row.team_slug} ${row.title ?? ""} ${row.target_bobblehead_id ?? ""}`;

const REVIEW_FILTERS: AdminFilter<ReviewRow>[] = [
  {
    id: "kind",
    allLabel: "All types",
    get: (row) => row.kind,
    options: [
      { value: "new_bobblehead", label: "New bobblehead" },
      { value: "photo_for_existing", label: "Photo for existing" },
    ],
  },
  {
    id: "duplicate",
    allLabel: "Any duplicate status",
    get: (row) => (row.duplicateOf ? "dup" : "unique"),
    options: [
      { value: "dup", label: "Possible duplicates" },
      { value: "unique", label: "No duplicate flagged" },
    ],
  },
];

async function rejectSubmission(submission: ReviewRow) {
  const { error: rpcError } = await supabase.rpc("reject_submission", {
    p_submission_id: submission.id,
  });

  if (rpcError) throw new Error(rpcError.message);
  // The pending file is kept on purpose: the submitter's profile history renders
  // rejected submissions from it (see lib/profile.ts), and RLS limits who can
  // see it to the submitter and the admin.
}

export default function AdminReviewPage() {
  const { user, isAdmin, isRep, isLoading, signOut } = useAdminAuth();
  // Reps are allowed in; RLS returns only their team's submissions, so the same
  // queries below just come back scoped without any per-page team filtering.
  const canReview = isAdmin || isRep;
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<EmailTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filter = useAdminFilters(rows, searchReview, REVIEW_FILTERS);
  const filtered = filter.filtered;
  const selection = useBulkSelection(filtered.map((row) => row.id));
  const bulk = useBulkRunner<ReviewRow>();

  useEffect(() => {
    if (!canReview) return;

    let cancelled = false;

    supabase
      .from("submissions")
      .select(
        "id, kind, target_bobblehead_id, team_slug, title, date, storage_path, submitted_by, created_at",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .then(async ({ data, error: fetchError }) => {
        if (cancelled) return;

        if (fetchError) {
          setError(fetchError.message);
          setIsLoadingRows(false);
          return;
        }

        const submissions = (data ?? []) as Submission[];

        const teamSlugs = Array.from(
          new Set(submissions.filter((s) => s.kind === "new_bobblehead").map((s) => s.team_slug)),
        );
        const { data: communityRows } = teamSlugs.length
          ? await supabase.from("community_bobbleheads").select("team_slug, title, date").in("team_slug", teamSlugs)
          : { data: [] as { team_slug: string; title: string; date: string }[] };
        const { isDeleted } = await fetchBobbleheadOverrides();
        const communityByTeam = new Map<string, DuplicateCandidate[]>();
        for (const row of communityRows ?? []) {
          const list = communityByTeam.get(row.team_slug) ?? [];
          list.push({ title: row.title, date: row.date });
          communityByTeam.set(row.team_slug, list);
        }

        const withUrls = await Promise.all(
          submissions.map(async (submission) => {
            const signed = submission.storage_path
              ? (
                  await supabase.storage
                    .from("bobblehead-pending")
                    .createSignedUrl(submission.storage_path, 60 * 10)
                ).data
              : null;

            const duplicateOf =
              submission.kind === "new_bobblehead" && submission.title
                ? findDuplicateBobblehead(
                    submission.team_slug,
                    submission.title,
                    communityByTeam.get(submission.team_slug) ?? [],
                    isDeleted,
                  )
                : null;

            return { ...submission, signedUrl: signed?.signedUrl ?? null, duplicateOf };
          }),
        );

        if (cancelled) return;

        setRows(withUrls);
        setIsLoadingRows(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canReview]);

  const runOne = async (submission: ReviewRow, action: (row: ReviewRow) => Promise<void>, fallback: string) => {
    setBusyId(submission.id);
    setError(null);
    try {
      await action(submission);
      setRows((current) => current.filter((row) => row.id !== submission.id));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : fallback);
    } finally {
      setBusyId(null);
    }
  };

  const approve = (submission: ReviewRow) =>
    runOne(submission, approveSubmission, "Could not approve submission.");
  const reject = (submission: ReviewRow) =>
    runOne(submission, rejectSubmission, "Could not reject submission.");

  // The submission row only carries the submitter's user id, so resolve their
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
      setError(lookupError instanceof Error ? lookupError.message : "Could not look up the submitter.");
    } finally {
      setMessagingId(null);
    }
  };

  const runBulkAction = async (
    action: (row: ReviewRow) => Promise<void>,
    verb: string,
  ) => {
    const targets = filtered.filter((row) => selection.isSelected(row.id));
    if (targets.length === 0) return;
    setError(null);

    const { succeeded, failed } = await bulk.run(targets, action);
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

  if (!user || !canReview) {
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
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">Review submissions</h1>
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
            filters={REVIEW_FILTERS}
            state={filter}
            placeholder="Search by team, title, or bobblehead…"
            total={rows.length}
            noun="submissions"
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
              onClick={() => runBulkAction(approveSubmission, "approve")}
              disabled={!selection.someSelected || bulk.busy}
            >
              Approve
            </BulkPrimaryButton>
            <BulkSecondaryButton
              onClick={() => runBulkAction(rejectSubmission, "reject")}
              disabled={!selection.someSelected || bulk.busy}
            >
              Reject
            </BulkSecondaryButton>
          </BulkSelectBar>
        </div>
      ) : null}

      <div className="mx-auto mt-6 max-w-4xl space-y-4">
        {isLoadingRows ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Nothing pending review.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No submissions match your search.</p>
        ) : (
          filtered.map((row) => {
            // A photo submission targets an existing listing; submissions don't
            // record whether it's curated or community, so fall back to the
            // build-time curated data to pick the right listing URL.
            const listingHref =
              row.kind === "photo_for_existing" && row.target_bobblehead_id
                ? GIVEAWAYS_BY_TEAM[row.team_slug]?.some((g) => g.id === row.target_bobblehead_id)
                  ? `/teams/${row.team_slug}/bobbleheads/${row.target_bobblehead_id}`
                  : `/teams/${row.team_slug}/community?id=${encodeURIComponent(row.target_bobblehead_id)}`
                : null;

            return (
            <div
              key={row.id}
              onClick={() => setDetailId(row.id)}
              className={`grid cursor-pointer gap-4 rounded-lg border bg-white p-4 transition hover:border-accent/50 dark:bg-[#0b1a29] sm:grid-cols-[auto_160px_1fr_auto] ${
                selection.isSelected(row.id) ? "border-accent/70 ring-1 ring-accent/40" : "border-black/10 dark:border-white/10"
              }`}
            >
              <label
                onClick={(event) => event.stopPropagation()}
                className="flex items-start justify-center pt-1 sm:items-center sm:pt-0"
              >
                <input
                  type="checkbox"
                  checked={selection.isSelected(row.id)}
                  onChange={() => selection.toggle(row.id)}
                  disabled={bulk.busy}
                  className="h-4 w-4 accent-accent"
                  aria-label="Select submission"
                />
              </label>

              <button
                type="button"
                onClick={() => setDetailId(row.id)}
                aria-label="View submission details"
                className="group relative h-40 w-40 overflow-hidden rounded"
              >
                {row.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.signedUrl}
                    alt="Submitted photo"
                    className="h-40 w-40 rounded object-cover transition group-hover:opacity-80"
                  />
                ) : (
                  <div className="grid h-40 w-40 place-items-center rounded bg-black/30 text-xs text-zinc-500 transition group-hover:bg-black/40">
                    No preview
                  </div>
                )}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[10px] font-black uppercase tracking-wide text-white opacity-0 transition group-hover:opacity-100">
                  View details
                </span>
              </button>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => setDetailId(row.id)}
                  className="font-black uppercase tracking-wide text-accent transition hover:text-accent-hover"
                >
                  {row.kind === "new_bobblehead" ? "New bobblehead" : "Photo for existing bobblehead"}
                </button>
                <p className="mt-1 text-zinc-800 dark:text-zinc-200">
                  Team: <span className="font-semibold">{row.team_slug}</span>
                </p>
                {row.kind === "new_bobblehead" ? (
                  <>
                    <p className="text-zinc-800 dark:text-zinc-200">
                      {row.title} · {row.date}
                    </p>
                    {row.duplicateOf ? (
                      <p className="mt-1 text-xs font-semibold text-accent">
                        ⚠ Possible duplicate of “{row.duplicateOf.title}” ({row.duplicateOf.date})
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-zinc-800 dark:text-zinc-200">
                    Target:{" "}
                    {listingHref ? (
                      <Link href={listingHref} onClick={(event) => event.stopPropagation()} className="font-semibold underline hover:text-accent-hover dark:hover:text-accent-hover">
                        {row.target_bobblehead_id}
                      </Link>
                    ) : (
                      <span className="font-semibold">{row.target_bobblehead_id}</span>
                    )}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  Submitted {new Date(row.created_at).toLocaleString()}
                </p>
              </div>

              <div onClick={(event) => event.stopPropagation()} className="flex flex-col justify-center gap-2">
                {/* Profile view and email are site-wide, admin-only tools (the
                    email edge function 403s a rep), so hide them from reps. */}
                {isAdmin ? (
                  <>
                    <Link
                      href={`/admin/users/view?id=${encodeURIComponent(row.submitted_by)}&from=review`}
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
                  </>
                ) : null}
                <button
                  type="button"
                  disabled={busyId === row.id || bulk.busy}
                  onClick={() => approve(row)}
                  className="rounded bg-accent px-4 py-2 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id || bulk.busy}
                  onClick={() => reject(row)}
                  className="rounded border border-black/15 dark:border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-red-400 hover:text-red-300 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
            );
          })
        )}
      </div>

      {(() => {
        const detail = detailId ? rows.find((row) => row.id === detailId) : null;
        if (!detail) return null;

        const detailListingHref =
          detail.kind === "photo_for_existing" && detail.target_bobblehead_id
            ? GIVEAWAYS_BY_TEAM[detail.team_slug]?.some((g) => g.id === detail.target_bobblehead_id)
              ? `/teams/${detail.team_slug}/bobbleheads/${detail.target_bobblehead_id}`
              : `/teams/${detail.team_slug}/community?id=${encodeURIComponent(detail.target_bobblehead_id)}`
            : null;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
            onClick={() => setDetailId(null)}
          >
            <div
              className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-black/10 bg-white text-zinc-900 shadow-2xl dark:border-white/10 dark:bg-[#0b1a29] dark:text-zinc-100"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-black/10 p-5 dark:border-white/10">
                <div>
                  <p className="text-lg font-black uppercase tracking-wide text-accent">
                    {detail.kind === "new_bobblehead" ? "New bobblehead" : "Photo for existing bobblehead"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Team: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{detail.team_slug}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailId(null)}
                  className="rounded border border-black/15 px-2 py-1 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover dark:border-white/20 dark:text-zinc-300 dark:hover:text-accent-hover"
                >
                  Close
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {detail.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detail.signedUrl}
                    alt="Submitted photo"
                    className="mx-auto max-h-[60vh] w-auto rounded object-contain"
                  />
                ) : (
                  <div className="grid h-48 w-full place-items-center rounded bg-black/30 text-sm text-zinc-500">
                    No photo submitted
                  </div>
                )}

                <dl className="mt-5 space-y-2 text-sm">
                  {detail.kind === "new_bobblehead" ? (
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 font-black uppercase tracking-wide text-zinc-500">Bobblehead</dt>
                      <dd className="text-zinc-800 dark:text-zinc-200">
                        {detail.title ?? "—"}
                        {detail.date ? <> · {detail.date}</> : null}
                      </dd>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 font-black uppercase tracking-wide text-zinc-500">Target</dt>
                      <dd className="text-zinc-800 dark:text-zinc-200">
                        {detailListingHref ? (
                          <Link href={detailListingHref} className="font-semibold underline hover:text-accent-hover">
                            {detail.target_bobblehead_id}
                          </Link>
                        ) : (
                          detail.target_bobblehead_id ?? "—"
                        )}
                      </dd>
                    </div>
                  )}
                  {detail.duplicateOf ? (
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 font-black uppercase tracking-wide text-zinc-500">Duplicate?</dt>
                      <dd className="font-semibold text-accent">
                        ⚠ Possible duplicate of “{detail.duplicateOf.title}” ({detail.duplicateOf.date})
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <dt className="w-32 shrink-0 font-black uppercase tracking-wide text-zinc-500">Submitted</dt>
                    <dd className="text-zinc-800 dark:text-zinc-200">{new Date(detail.created_at).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/10 p-5 dark:border-white/10">
                {isAdmin ? (
                  <>
                    <Link
                      href={`/admin/users/view?id=${encodeURIComponent(detail.submitted_by)}&from=review`}
                      className="rounded border border-black/15 px-4 py-2 text-center text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover dark:border-white/20 dark:text-zinc-200 dark:hover:text-accent-hover"
                    >
                      View profile
                    </Link>
                    <button
                      type="button"
                      disabled={messagingId === detail.submitted_by || bulk.busy}
                      onClick={() => {
                        setDetailId(null);
                        messageSubmitter(detail.submitted_by);
                      }}
                      className="rounded border border-black/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover disabled:opacity-60 dark:border-white/20 dark:text-zinc-200 dark:hover:text-accent-hover"
                    >
                      Message
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  disabled={busyId === detail.id || bulk.busy}
                  onClick={() => reject(detail)}
                  className="rounded border border-black/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-red-400 hover:text-red-300 disabled:opacity-60 dark:border-white/20 dark:text-zinc-200"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={busyId === detail.id || bulk.busy}
                  onClick={() => approve(detail)}
                  className="rounded bg-accent px-4 py-2 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
