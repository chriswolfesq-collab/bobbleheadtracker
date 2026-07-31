"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useAdminAuth } from "@/lib/adminAuth";
import { mergeTags } from "@/lib/adminTags";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { tagHref } from "@/lib/tags";
import { describeSimilarity } from "@/lib/tagSimilarity";
import { daysSince, type ReviewablePair, useTagDuplicates } from "@/lib/useTagDuplicates";

// Tags that look like one idea twice, for review. The picker asks before it
// mints a near-duplicate, but the answer is deliberately allowed to be "create
// it anyway" — this is where those land, along with every pair that predates
// the question being asked at all.

const buttonClass =
  "rounded border border-black/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover disabled:opacity-50";

// A pair is only worth calling new for as long as an admin could plausibly not
// have seen it yet.
const NEW_FOR_DAYS = 7;

function PairCard({
  pair,
  busy,
  now,
  onMerge,
  onDismiss,
  onRestore,
}: {
  pair: ReviewablePair;
  busy: boolean;
  now: number;
  onMerge: (fromSlug: string, intoSlug: string) => void;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  const age = daysSince(pair.newerCreatedAt, now);
  const isNew = !pair.dismissedAt && age !== null && age <= NEW_FOR_DAYS;

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {isNew ? (
          <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
            New
          </span>
        ) : null}
        <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
          {describeSimilarity(pair.reason)}
        </span>
        {age !== null ? (
          <span className="text-xs text-zinc-500">
            · newer one added {age === 0 ? "today" : `${age} ${age === 1 ? "day" : "days"} ago`}
          </span>
        ) : null}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {[pair.a, pair.b].map((tag) => (
          <div key={tag.slug} className="rounded border border-black/10 bg-slate-50 px-3 py-2">
            <p className="truncate text-sm font-semibold text-zinc-900">{tag.label}</p>
            <p className="truncate text-xs text-zinc-500">
              <Link href={tagHref(tag.slug)} className="hover:text-accent-hover">
                /tags/{tag.slug}
              </Link>{" "}
              · {tag.listingCount} {tag.listingCount === 1 ? "listing" : "listings"}
            </p>
          </div>
        ))}
      </div>

      {pair.dismissedAt ? (
        <div className="mt-3 flex items-center gap-3">
          <p className="text-xs text-zinc-500">Marked as two different tags.</p>
          <button type="button" onClick={onRestore} disabled={busy} className={buttonClass}>
            Undo
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Both directions offered rather than guessing: the bigger tag is
              usually the keeper, but not when the bigger one is the misspelt
              one. */}
          <button
            type="button"
            onClick={() => onMerge(pair.b.slug, pair.a.slug)}
            disabled={busy}
            className={buttonClass}
          >
            Keep {pair.a.label}
          </button>
          <button
            type="button"
            onClick={() => onMerge(pair.a.slug, pair.b.slug)}
            disabled={busy}
            className={buttonClass}
          >
            Keep {pair.b.label}
          </button>
          <button type="button" onClick={onDismiss} disabled={busy} className={buttonClass}>
            Not a duplicate
          </button>
        </div>
      )}
    </li>
  );
}

export default function AdminDuplicateTagsPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const { open, dismissed, isLoading: isLoadingPairs, needsSetup, dismiss, restore, reload } =
    useTagDuplicates();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  // Read once, through a lazy initialiser rather than at render time, so "3
  // days ago" doesn't quietly change under a long-lived page. Nothing that
  // depends on it renders before the pairs load, which is client-only, so the
  // server's clock never reaches the markup.
  const [now] = useState(() => Date.now());

  const run = async (work: () => Promise<{ error: string | null }>, success: string) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    const result = await work();
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setNotice(success);
  };

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
        <p className="text-sm font-black uppercase tracking-wide text-zinc-900">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-600">
          Only a full admin can review the tag vocabulary.
        </p>
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
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/admin", label: "Admin" },
            { label: "Duplicate tags" },
          ]}
        />
        <h1 className="mt-3 text-2xl font-black uppercase tracking-wide">Duplicate tags</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Pairs that look like one idea under two names. The picker asks before minting one of
          these, but whoever is tagging can say they meant it — so every pair lands here, including
          the ones that were already in the vocabulary. Merging keeps both sets of listings;{" "}
          <Link href="/admin/tags" className="font-semibold text-accent hover:text-accent-hover">
            manage tags
          </Link>{" "}
          has the rest of the vocabulary.
        </p>

        {needsSetup ? (
          <p className="mt-6 rounded-lg border border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Pairs are listed below, but marking one as{" "}
            <span className="font-semibold">not a duplicate</span> needs one more table. Run{" "}
            <span className="font-mono text-xs">supabase/tag_duplicates.sql</span> in the Supabase
            SQL editor and reload.
          </p>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {notice ? <p className="mt-4 text-sm text-emerald-600">{notice}</p> : null}

        {isLoadingPairs ? (
          <p className="mt-6 text-sm text-zinc-600">Loading…</p>
        ) : (
          <>
            <p className="mt-6 text-xs font-black uppercase tracking-wide text-zinc-500">
              {open.length === 0
                ? "Nothing to review"
                : `${open.length} ${open.length === 1 ? "pair" : "pairs"} to review`}
            </p>

            {open.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600">
                No two tags in the vocabulary look like the same thing.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-black/10 rounded-lg border border-black/10 bg-white">
                {open.map((pair) => (
                  <PairCard
                    key={pair.key}
                    pair={pair}
                    busy={busy}
                    now={now}
                    onMerge={(fromSlug, intoSlug) =>
                      run(async () => {
                        const result = await mergeTags(supabase, {
                          fromSlug,
                          intoSlug,
                          createdBy: user.id,
                        });
                        if (!result.error) reload();
                        return result;
                      }, `Merged — ${pair.a.label} and ${pair.b.label} are one tag now.`)
                    }
                    onDismiss={() =>
                      run(
                        () => dismiss(pair),
                        `Kept both — ${pair.a.label} and ${pair.b.label} won't be flagged again.`,
                      )
                    }
                    onRestore={() => run(() => restore(pair), "Back in the review list.")}
                  />
                ))}
              </ul>
            )}

            {dismissed.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowDismissed((current) => !current)}
                  className="mt-8 text-xs font-black uppercase tracking-wide text-zinc-500 transition hover:text-accent-hover"
                >
                  {showDismissed ? "Hide" : "Show"} {dismissed.length} already reviewed
                </button>
                {showDismissed ? (
                  <ul className="mt-2 divide-y divide-black/10 rounded-lg border border-black/10 bg-white">
                    {dismissed.map((pair) => (
                      <PairCard
                        key={pair.key}
                        pair={pair}
                        busy={busy}
                        now={now}
                        onMerge={() => undefined}
                        onDismiss={() => undefined}
                        onRestore={() => run(() => restore(pair), "Back in the review list.")}
                      />
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
