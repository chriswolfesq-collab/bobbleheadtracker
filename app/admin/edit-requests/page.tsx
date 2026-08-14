"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useAdminAuth } from "@/lib/adminAuth";
import { type BobbleheadIdentity, buildBobbleheadResolver } from "@/lib/bobbleheadIdentity";
import {
  approveDescriptionEdit,
  rejectDescriptionEdit,
  type DescriptionEditRequest,
} from "@/lib/descriptionEdits";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// Description edits waiting on a ruling. Unlike the tag queue this is open to
// team reps as well as the admin: a description belongs to one team's listing,
// so RLS hands a rep exactly their team's rows and an admin the lot — the
// query below is the same either way (supabase/description_edits.sql).
//
// Publishing writes the text onto the listing row, whose revalidate trigger
// rebuilds the prerendered page.

type PendingEdit = DescriptionEditRequest & { listing: BobbleheadIdentity | null };

export default function AdminEditRequestsPage() {
  const { user, isAdmin, isRep, isLoading, signOut } = useAdminAuth();
  const canReview = isAdmin || isRep;
  const [rows, setRows] = useState<PendingEdit[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canReview) return;

    let cancelled = false;

    (async () => {
      const { data, error: fetchError } = await supabase
        .from("description_edit_requests")
        .select("id, bobblehead_id, team_slug, source, proposed, requested_by, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setIsLoadingRows(false);
        return;
      }

      const requests = (data ?? []) as DescriptionEditRequest[];

      // Same resolver the tag queue uses: a suggestion for a since-deleted
      // listing still renders, just without a link.
      let resolve: ((teamSlug: string, bobbleheadId: string) => BobbleheadIdentity) | null = null;
      if (requests.length > 0) {
        resolve = await buildBobbleheadResolver(supabase, [
          ...new Set(requests.map((row) => row.team_slug)),
        ]);
      }

      if (cancelled) return;

      setRows(
        requests.map((row) => ({
          ...row,
          listing: resolve ? resolve(row.team_slug, row.bobblehead_id) : null,
        })),
      );
      setIsLoadingRows(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [canReview]);

  const rule = async (request: PendingEdit, ruling: "approve" | "reject") => {
    if (!user) return;
    setBusyId(request.id);
    setError(null);

    const result =
      ruling === "approve"
        ? await approveDescriptionEdit(request, user.id)
        : await rejectDescriptionEdit(request.id);

    if (result.error) {
      setError(result.error);
    } else {
      setRows((current) => current.filter((row) => row.id !== request.id));
    }
    setBusyId(null);
  };

  if (isLoading) {
    return null;
  }

  if (!user || !canReview) {
    return (
      <main className="min-h-full bg-slate-50 px-4 py-10 text-center text-zinc-900">
        <p className="text-sm font-black uppercase tracking-wide text-zinc-900">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-600">
          Log in as a team rep or the admin to continue.
        </p>
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
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { href: "/", label: "Home" },
              { href: "/admin", label: "Admin" },
              { label: "Description edits" },
            ]}
          />
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">Description edits</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Rewrites members have suggested for the About This Bobblehead text
            {isRep && !isAdmin ? " on your team's listings" : ""}. Publishing replaces what the
            listing shows.
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
        <p className="mx-auto mt-4 max-w-4xl text-sm font-semibold text-red-400">{error}</p>
      ) : null}

      <div className="mx-auto mt-6 max-w-4xl space-y-4">
        {isLoadingRows ? (
          <p className="text-sm text-zinc-600">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-600">No description edits waiting.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-4 rounded-lg border border-black/10 bg-white p-4 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0 text-sm">
                <p className="text-zinc-800">
                  For:{" "}
                  {row.listing ? (
                    <Link
                      href={row.listing.href}
                      className="font-semibold underline hover:text-accent-hover"
                    >
                      {row.listing.title}
                    </Link>
                  ) : (
                    <span className="font-semibold">{row.bobblehead_id}</span>
                  )}{" "}
                  <span className="text-zinc-500">({row.team_slug})</span>
                </p>
                {/* The proposal itself is the decision — shown in full, not
                    truncated, so nobody rules on an ellipsis. */}
                <p className="mt-2 whitespace-pre-wrap rounded border border-black/10 bg-slate-50 p-3 leading-6 text-zinc-800">
                  {row.proposed}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Suggested {new Date(row.created_at).toLocaleString()} ·{" "}
                  <Link
                    href={`/admin/users/view?id=${encodeURIComponent(row.requested_by)}&from=edit-requests`}
                    className="underline hover:text-accent-hover"
                  >
                    view requester
                  </Link>
                </p>
              </div>

              <div className="flex flex-col justify-center gap-2">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => rule(row, "approve")}
                  className="rounded bg-accent px-4 py-2 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
                >
                  Publish
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => rule(row, "reject")}
                  className="rounded border border-black/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-red-400 hover:text-red-300 disabled:opacity-60"
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
