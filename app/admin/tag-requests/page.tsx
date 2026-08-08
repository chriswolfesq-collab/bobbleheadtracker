"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useAdminAuth } from "@/lib/adminAuth";
import { type BobbleheadIdentity, buildBobbleheadResolver } from "@/lib/bobbleheadIdentity";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { approveTagRequest, rejectTagRequest, type TagRequest } from "@/lib/tagRequests";
import { useTagVocabulary } from "@/lib/useTags";

// The queue behind the admin-curated tag vocabulary: every tag a rep has asked
// for, waiting on a ruling. Approve mints the tag if it's new and applies it
// to the listing; reject leaves the vocabulary alone. Either way the request
// row keeps its outcome, so a rep's pending chip resolves rather than
// vanishing without a trace.

type PendingRequest = TagRequest & { listing: BobbleheadIdentity | null };

export default function AdminTagRequestsPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [rows, setRows] = useState<PendingRequest[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // To label each ask as brand new or already in the vocabulary — approving
  // "Star Wras" and approving "Star Wars" are different decisions.
  const { tags: vocabulary } = useTagVocabulary();
  const knownSlugs = new Set(vocabulary.map((tag) => tag.slug));

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    (async () => {
      const { data, error: fetchError } = await supabase
        .from("tag_requests")
        .select("id, label, slug, bobblehead_id, team_slug, source, requested_by, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setIsLoadingRows(false);
        return;
      }

      const requests = (data ?? []) as TagRequest[];

      // Resolve each listing to the title and href it shows everywhere else;
      // a request for a listing that has since been deleted still renders,
      // just without a link.
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
  }, [isAdmin]);

  const rule = async (request: PendingRequest, ruling: "approve" | "reject") => {
    if (!user) return;
    setBusyId(request.id);
    setError(null);

    const result =
      ruling === "approve"
        ? await approveTagRequest(supabase, request, user.id)
        : await rejectTagRequest(supabase, request.id);

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

  if (!user || !isAdmin) {
    return (
      <main className="min-h-full bg-slate-50 px-4 py-10 text-center text-zinc-900">
        <p className="text-sm font-black uppercase tracking-wide text-zinc-900">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-600">Log in with the admin account to continue.</p>
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
              { label: "Tag requests" },
            ]}
          />
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">Tag requests</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Tags a team rep wants added to a listing. Approving creates the tag if it doesn&apos;t
            exist yet.
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

      {error ? <p className="mx-auto mt-4 max-w-4xl text-sm font-semibold text-red-400">{error}</p> : null}

      <div className="mx-auto mt-6 max-w-4xl space-y-4">
        {isLoadingRows ? (
          <p className="text-sm text-zinc-600">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-600">No pending tag requests.</p>
        ) : (
          rows.map((row) => {
            const isNewTag = !knownSlugs.has(row.slug);

            return (
              <div
                key={row.id}
                className="grid gap-4 rounded-lg border border-black/10 bg-white p-4 sm:grid-cols-[1fr_auto]"
              >
                <div className="text-sm">
                  <p>
                    <span className="inline-flex items-center rounded-full border border-brass/40 bg-brass/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy">
                      {row.label}
                    </span>
                    <span
                      className={`ml-2 text-xs font-black uppercase tracking-wide ${
                        isNewTag ? "text-accent" : "text-zinc-500"
                      }`}
                    >
                      {isNewTag ? "New tag" : "Already in the vocabulary"}
                    </span>
                  </p>
                  <p className="mt-2 text-zinc-800">
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
                  <p className="mt-1 text-xs text-zinc-500">
                    Requested {new Date(row.created_at).toLocaleString()} ·{" "}
                    <Link
                      href={`/admin/users/view?id=${encodeURIComponent(row.requested_by)}&from=tag-requests`}
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
                    Approve
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
            );
          })
        )}
      </div>
    </main>
  );
}
