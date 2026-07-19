"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BulkPrimaryButton, BulkSecondaryButton, BulkSelectBar } from "@/components/BulkSelectBar";
import { useAdminAuth } from "@/lib/adminAuth";
import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";
import { fetchBobbleheadOverrides } from "@/lib/bobbleheadOverrides";
import { findDuplicateBobblehead, type DuplicateCandidate } from "@/lib/duplicateCheck";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { useBulkRunner } from "@/lib/useBulkRunner";
import { useBulkSelection } from "@/lib/useBulkSelection";

type Submission = {
  id: string;
  kind: "photo_for_existing" | "new_bobblehead";
  target_bobblehead_id: string | null;
  team_slug: string;
  title: string | null;
  date: string | null;
  storage_path: string;
  submitted_by: string;
  created_at: string;
};

type ReviewRow = Submission & { signedUrl: string | null; duplicateOf: DuplicateCandidate | null };

async function moveToApproved(storagePath: string, submissionId: string) {
  const { data: file, error: downloadError } = await supabase.storage
    .from("bobblehead-pending")
    .download(storagePath);

  if (downloadError || !file) {
    throw new Error(downloadError?.message ?? "Could not read the submitted photo.");
  }

  const filename = storagePath.split("/").pop() ?? "photo";
  const approvedPath = `${submissionId}-${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("bobblehead-approved")
    .upload(approvedPath, file, { upsert: true });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage.from("bobblehead-approved").getPublicUrl(approvedPath);

  return { publicUrl: publicUrlData.publicUrl, approvedPath };
}

// approve_submission() decides main-photo-vs-gallery inside the transaction;
// the only photo source the database can't see is the curated seed photo in
// the build-time data, so that one static fact is passed along.
function curatedHasSeedPhoto(teamSlug: string, bobbleheadId: string): boolean {
  const curated = GIVEAWAYS_BY_TEAM[teamSlug]?.find((giveaway) => giveaway.id === bobbleheadId);
  return Boolean(curated?.imageUrl);
}

// Core approve/reject work, throwing on failure so it can be reused by both the
// single-row handlers and the bulk runner. Neither touches component state.
async function approveSubmission(submission: ReviewRow) {
  const { publicUrl, approvedPath } = await moveToApproved(submission.storage_path, submission.id);
  const curatedHasPhoto =
    submission.kind === "photo_for_existing" && submission.target_bobblehead_id
      ? curatedHasSeedPhoto(submission.team_slug, submission.target_bobblehead_id)
      : false;

  const { error: rpcError } = await supabase.rpc("approve_submission", {
    p_submission_id: submission.id,
    p_image_url: publicUrl,
    p_curated_has_photo: curatedHasPhoto,
  });

  if (rpcError) {
    // The copy made by moveToApproved is orphaned if the approval didn't go
    // through — best-effort cleanup, keeping the original error.
    await supabase.storage
      .from("bobblehead-approved")
      .remove([approvedPath])
      .catch(() => undefined);
    throw new Error(rpcError.message);
  }

  await supabase.storage.from("bobblehead-pending").remove([submission.storage_path]);
}

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
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selection = useBulkSelection(rows.map((row) => row.id));
  const bulk = useBulkRunner<ReviewRow>();

  useEffect(() => {
    if (!isAdmin) return;

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
            const { data: signed } = await supabase.storage
              .from("bobblehead-pending")
              .createSignedUrl(submission.storage_path, 60 * 10);

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
  }, [isAdmin]);

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

  const runBulkAction = async (
    action: (row: ReviewRow) => Promise<void>,
    verb: string,
  ) => {
    const targets = rows.filter((row) => selection.isSelected(row.id));
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
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">Review submissions</h1>
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

      {!isLoadingRows && rows.length > 0 ? (
        <div className="mt-6">
          <BulkSelectBar
            total={rows.length}
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
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-400">Nothing pending review.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className={`grid gap-4 rounded-lg border bg-[#0b1a29] p-4 sm:grid-cols-[auto_160px_1fr_auto] ${
                selection.isSelected(row.id) ? "border-amber-500/70 ring-1 ring-amber-500/40" : "border-white/10"
              }`}
            >
              <label className="flex items-start justify-center pt-1 sm:items-center sm:pt-0">
                <input
                  type="checkbox"
                  checked={selection.isSelected(row.id)}
                  onChange={() => selection.toggle(row.id)}
                  disabled={bulk.busy}
                  className="h-4 w-4 accent-amber-500"
                  aria-label="Select submission"
                />
              </label>

              {row.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.signedUrl}
                  alt="Submitted photo"
                  className="h-40 w-40 rounded object-cover"
                />
              ) : (
                <div className="grid h-40 w-40 place-items-center rounded bg-black/30 text-xs text-zinc-500">
                  No preview
                </div>
              )}

              <div className="text-sm">
                <p className="font-black uppercase tracking-wide text-amber-300">
                  {row.kind === "new_bobblehead" ? "New bobblehead" : "Photo for existing bobblehead"}
                </p>
                <p className="mt-1 text-zinc-200">
                  Team: <span className="font-semibold">{row.team_slug}</span>
                </p>
                {row.kind === "new_bobblehead" ? (
                  <>
                    <p className="text-zinc-200">
                      {row.title} · {row.date}
                    </p>
                    {row.duplicateOf ? (
                      <p className="mt-1 text-xs font-semibold text-amber-300">
                        ⚠ Possible duplicate of “{row.duplicateOf.title}” ({row.duplicateOf.date})
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-zinc-200">
                    Target: <span className="font-semibold">{row.target_bobblehead_id}</span>
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  Submitted {new Date(row.created_at).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-col justify-center gap-2">
                <Link
                  href={`/admin/users/view?id=${encodeURIComponent(row.submitted_by)}&from=review`}
                  className="rounded border border-white/20 px-4 py-2 text-center text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
                >
                  View profile
                </Link>
                <button
                  type="button"
                  disabled={busyId === row.id || bulk.busy}
                  onClick={() => approve(row)}
                  className="rounded bg-amber-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id || bulk.busy}
                  onClick={() => reject(row)}
                  className="rounded border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-red-400 hover:text-red-300 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
