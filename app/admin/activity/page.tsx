"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useAdminAuth } from "@/lib/adminAuth";
import { bobbleheadHref } from "@/lib/bobbleheadIdentity";
import { getGiveawayById } from "@/lib/bobbleheads";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { TEAMS } from "@/lib/teams";

// The rep activity log (see supabase/rep_activity.sql) — the same rows the daily
// digest email summarizes, unsummarized. Reads the table directly rather than
// through an RPC because RLS already answers the question correctly for both
// audiences: an admin sees everything, a rep sees only their own trail.

type Activity = {
  id: number;
  actor_email: string | null;
  action: string;
  team_slug: string | null;
  bobblehead_id: string | null;
  detail: string | null;
  created_at: string;
};

const PAGE_SIZE = 100;

// Kept in step with the action strings the triggers write.
const ACTION_LABELS: Record<string, string> = {
  listing_edited: "Edited a listing",
  listing_deleted: "Deleted a listing",
  listing_restored: "Restored a listing",
  photo_removed: "Removed a photo",
  photo_set: "Set a main photo",
  bobblehead_added: "Added a bobblehead",
  gallery_photo_approved: "Approved a gallery photo",
  submission_approved: "Approved a submission",
  submission_rejected: "Rejected a submission",
  report_resolved: "Resolved a report",
  report_dismissed: "Dismissed a report",
  tag_removed: "Removed a tag",
};

const DESTRUCTIVE = new Set([
  "listing_deleted",
  "photo_removed",
  "submission_rejected",
  "tag_removed",
]);

// A deleted listing's detail page 404s (see the bobblehead route), so the one
// entry that names a target you can't visit doesn't become a link.
const NO_TARGET = new Set(["listing_deleted"]);

const teamName = (slug: string) => TEAMS.find((t) => t.slug === slug)?.name ?? slug;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminActivityPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [rows, setRows] = useState<Activity[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  // "team_slug:bobblehead_id" for every logged target that turned out to be a
  // community listing. See the lookup below for why it takes a second query.
  const [communityKeys, setCommunityKeys] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    let cancelled = false;

    (async () => {
      const { data, error: queryError } = await supabase
        .from("rep_activity")
        .select("id, actor_email, action, team_slug, bobblehead_id, detail, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setIsLoadingRows(false);
        return;
      }

      const loaded = (data ?? []) as Activity[];
      setError(null);
      setRows(loaded);
      setIsLoadingRows(false);

      // bobblehead_id isn't always an id: the submission triggers fall back to
      // the submission's free-text title when there's no target listing yet.
      // The curated catalog is bundled, so it answers for itself; whatever it
      // doesn't recognize needs one lookup to tell a real community listing
      // from one of those titles, which keeps titles from becoming links to
      // pages that don't exist.
      const unknownIds = [
        ...new Set(
          loaded
            .filter(
              (row) =>
                row.team_slug &&
                row.bobblehead_id &&
                !getGiveawayById(row.bobblehead_id, row.team_slug),
            )
            .map((row) => row.bobblehead_id as string),
        ),
      ];

      if (unknownIds.length === 0) {
        setCommunityKeys(new Set());
        return;
      }

      const { data: communityRows } = await supabase
        .from("community_bobbleheads")
        .select("id, team_slug")
        .in("id", unknownIds);

      if (cancelled) return;
      setCommunityKeys(
        new Set((communityRows ?? []).map((row) => `${row.team_slug}:${row.id}`)),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [days]);

  useEffect(() => {
    if (!isAdmin) return;
    return load();
  }, [isAdmin, load]);

  // Where an entry points, or null when there's nothing to open.
  const targetHref = useCallback(
    (row: Activity): string | null => {
      if (!row.team_slug || !row.bobblehead_id) return null;
      if (NO_TARGET.has(row.action)) return null;
      if (getGiveawayById(row.bobblehead_id, row.team_slug)) {
        return bobbleheadHref(row.team_slug, row.bobblehead_id, true);
      }
      if (communityKeys.has(`${row.team_slug}:${row.bobblehead_id}`)) {
        return bobbleheadHref(row.team_slug, row.bobblehead_id, false);
      }
      return null;
    },
    [communityKeys],
  );

  // Who was active in the window, so the page opens with the same summary the
  // digest email leads with.
  const byActor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = row.actor_email ?? "unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  if (isLoading) return null;

  if (!user) {
    return (
      <main className="min-h-full bg-slate-50 px-4 py-10 text-zinc-900">
        <AdminLoginForm />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-full bg-slate-50 px-4 py-10 text-center text-zinc-900">
        <p className="text-sm font-black uppercase tracking-wide">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-600">Only a full admin can see the whole log.</p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 rounded border border-black/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover"
        >
          Log out
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/admin", label: "Admin" },
            { label: "Activity" },
          ]}
        />
        <h1 className="mt-3 text-2xl font-black uppercase tracking-wide">Activity</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Every change a rep or admin has made to a listing, photo, submission or report. The daily
          summary email covers the same ground — turn it off in{" "}
          <Link href="/settings" className="font-semibold text-accent hover:text-accent-hover">
            Settings
          </Link>
          .
        </p>

        <div className="mt-6 flex gap-2">
          {[1, 7, 30].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setIsLoadingRows(true);
                setDays(option);
              }}
              className={`rounded border px-3 py-1.5 text-xs font-black uppercase tracking-wide transition ${
                days === option
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-black/15 text-zinc-700 hover:border-accent hover:text-accent-hover"
              }`}
            >
              {option === 1 ? "Last 24h" : `Last ${option} days`}
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {isLoadingRows ? (
          <p className="mt-6 text-sm text-zinc-600">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600">
            No activity in this window. If you just set the log up, it only records changes made
            from now on.
          </p>
        ) : (
          <>
            <div className="mt-6 rounded-lg border border-black/10 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                {rows.length === PAGE_SIZE ? `${PAGE_SIZE}+ changes` : `${rows.length} changes`} ·{" "}
                {byActor.length} {byActor.length === 1 ? "person" : "people"}
              </p>
              <ul className="mt-2 space-y-1">
                {byActor.map(([email, count]) => (
                  <li key={email} className="text-sm text-zinc-700">
                    <span className="font-semibold">{email}</span>{" "}
                    <span className="text-zinc-500">
                      — {count} {count === 1 ? "change" : "changes"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="mt-4 divide-y divide-black/10 rounded-lg border border-black/10 bg-white">
              {rows.map((row) => {
                const href = targetHref(row);
                const body = (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-900">
                        <span
                          className={
                            DESTRUCTIVE.has(row.action) ? "text-red-600" : "text-zinc-900"
                          }
                        >
                          {ACTION_LABELS[row.action] ?? row.action}
                        </span>
                        {row.team_slug ? (
                          <span className="ml-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                            {teamName(row.team_slug)}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-zinc-500">{formatWhen(row.created_at)}</p>
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-600">{row.detail}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{row.actor_email ?? "unknown"}</p>
                  </>
                );

                // The whole entry is the target — reading "Edited <listing>"
                // and then hunting for that listing by hand was the missing
                // half of the log.
                return (
                  <li key={row.id}>
                    {href ? (
                      <Link
                        href={href}
                        className="block px-4 py-3 transition hover:bg-accent/[0.06] focus:outline-none focus-visible:bg-accent/[0.06]"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            {rows.length === PAGE_SIZE ? (
              <p className="mt-3 text-xs text-zinc-500">
                Showing the most recent {PAGE_SIZE}. Narrow the window to see less busy days in
                full.
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
