"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";
import { findDuplicateBobblehead, type DuplicateCandidate } from "@/lib/duplicateCheck";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

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

  return publicUrlData.publicUrl;
}

// The database only knows about approved_photos / community_bobbleheads, not
// the hardcoded seed photos in lib/bobbleheads.ts, so "does this bobblehead
// already have a photo" has to be resolved client-side across all three
// sources before deciding whether an approval becomes the main photo or a
// gallery addition.
async function hasExistingPhoto(teamSlug: string, bobbleheadId: string): Promise<boolean> {
  const { data: approved } = await supabase
    .from("approved_photos")
    .select("bobblehead_id")
    .eq("bobblehead_id", bobbleheadId)
    .maybeSingle();

  if (approved) return true;

  const curated = GIVEAWAYS_BY_TEAM[teamSlug]?.find((giveaway) => giveaway.id === bobbleheadId);
  if (curated?.imageUrl) return true;

  const { data: community } = await supabase
    .from("community_bobbleheads")
    .select("image_url")
    .eq("id", bobbleheadId)
    .maybeSingle();

  return Boolean(community?.image_url);
}

export default function AdminReviewPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const approve = async (submission: ReviewRow) => {
    setBusyId(submission.id);
    setError(null);

    try {
      const imageUrl = await moveToApproved(submission.storage_path, submission.id);
      const hasExisting =
        submission.kind === "photo_for_existing" && submission.target_bobblehead_id
          ? await hasExistingPhoto(submission.team_slug, submission.target_bobblehead_id)
          : false;

      const { error: rpcError } = await supabase.rpc("approve_submission", {
        p_submission_id: submission.id,
        p_image_url: imageUrl,
        p_has_existing_photo: hasExisting,
      });

      if (rpcError) throw new Error(rpcError.message);

      await supabase.storage.from("bobblehead-pending").remove([submission.storage_path]);
      setRows((current) => current.filter((row) => row.id !== submission.id));
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Could not approve submission.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (submission: ReviewRow) => {
    setBusyId(submission.id);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc("reject_submission", {
        p_submission_id: submission.id,
      });

      if (rpcError) throw new Error(rpcError.message);

      await supabase.storage.from("bobblehead-pending").remove([submission.storage_path]);
      setRows((current) => current.filter((row) => row.id !== submission.id));
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Could not reject submission.");
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

      <div className="mx-auto mt-6 max-w-4xl space-y-4">
        {isLoadingRows ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-400">Nothing pending review.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-4 rounded-lg border border-white/10 bg-[#0b1a29] p-4 sm:grid-cols-[160px_1fr_auto]"
            >
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
