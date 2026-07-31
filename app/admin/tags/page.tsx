"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useAdminAuth } from "@/lib/adminAuth";
import { deleteTag, mergeTags, renameTag } from "@/lib/adminTags";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { slugifyTag, sortTags, type TagWithCount, tagHref } from "@/lib/tags";
import { useTagVocabulary } from "@/lib/useTags";

// The vocabulary, editable. A listing page can only put a tag on or take it
// off; this is where a label gets fixed, a stray tag gets retired, and two tags
// that mean the same thing become one.

type RowAction = "rename" | "merge" | "delete";

function TagRow({
  tag,
  others,
  busy,
  onRename,
  onMerge,
  onDelete,
}: {
  tag: TagWithCount;
  others: TagWithCount[];
  busy: boolean;
  onRename: (label: string) => void;
  onMerge: (intoSlug: string) => void;
  onDelete: () => void;
}) {
  const [action, setAction] = useState<RowAction | null>(null);
  const [label, setLabel] = useState(tag.label);
  const [intoSlug, setIntoSlug] = useState("");

  const open = (next: RowAction) => {
    setLabel(tag.label);
    setIntoSlug("");
    setAction(action === next ? null : next);
  };

  const buttonClass =
    "rounded border border-black/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover disabled:opacity-50";
  const inputClass =
    "w-full rounded border border-black/15 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-accent focus:outline-none";

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900">{tag.label}</p>
          <p className="truncate text-xs text-zinc-500">
            <Link href={tagHref(tag.slug)} className="hover:text-accent-hover">
              /tags/{tag.slug}
            </Link>{" "}
            · {tag.listingCount} {tag.listingCount === 1 ? "listing" : "listings"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => open("rename")} disabled={busy} className={buttonClass}>
            Rename
          </button>
          <button type="button" onClick={() => open("merge")} disabled={busy} className={buttonClass}>
            Merge
          </button>
          <button
            type="button"
            onClick={() => open("delete")}
            disabled={busy}
            className={`${buttonClass} hover:border-red-500 hover:text-red-500`}
          >
            Delete
          </button>
        </div>
      </div>

      {action === "rename" ? (
        <form
          className="mt-3 rounded border border-black/10 bg-slate-50 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            onRename(label);
            setAction(null);
          }}
        >
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
              What it&apos;s called
            </span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
          {/* The slug is the URL and the join key, so it deliberately doesn't
              follow the label. Say so here rather than letting an admin
              discover it from a link that still reads /tags/star-wras. */}
          <p className="mt-2 text-xs text-zinc-500">
            The address stays <span className="font-semibold">/tags/{tag.slug}</span> so shared links
            keep working
            {slugifyTag(label) !== tag.slug ? ", even though the new name would slug differently" : ""}
            . To retire a wrong tag, merge it instead.
          </p>
          <button type="submit" disabled={busy} className={`mt-3 ${buttonClass}`}>
            Save name
          </button>
        </form>
      ) : null}

      {action === "merge" ? (
        <form
          className="mt-3 rounded border border-black/10 bg-slate-50 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!intoSlug) return;
            onMerge(intoSlug);
            setAction(null);
          }}
        >
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
              Merge into
            </span>
            <select
              value={intoSlug}
              onChange={(e) => setIntoSlug(e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              <option value="">Pick a tag…</option>
              {others.map((other) => (
                <option key={other.slug} value={other.slug}>
                  {other.label} ({other.listingCount})
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-zinc-500">
            All {tag.listingCount} {tag.listingCount === 1 ? "listing" : "listings"} carrying{" "}
            <span className="font-semibold">{tag.label}</span> get the other tag, then this one is
            deleted. Nothing loses a label.
          </p>
          <button type="submit" disabled={busy || !intoSlug} className={`mt-3 ${buttonClass}`}>
            Merge and delete
          </button>
        </form>
      ) : null}

      {action === "delete" ? (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700">
            {tag.listingCount === 0
              ? "Nothing carries this tag — deleting it affects no listings."
              : `This takes the tag off all ${tag.listingCount} ${
                  tag.listingCount === 1 ? "listing" : "listings"
                } carrying it. To keep them labelled, merge instead.`}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onDelete();
                setAction(null);
              }}
              className={`${buttonClass} border-red-300 text-red-700 hover:border-red-500 hover:text-red-500`}
            >
              Delete {tag.label}
            </button>
            <button type="button" onClick={() => setAction(null)} className={buttonClass}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export default function AdminTagsPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const { tags, isLoading: isLoadingTags, reload } = useTagVocabulary();
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sorted = useMemo(() => sortTags(tags), [tags]);
  const shown = useMemo(() => {
    const term = slugifyTag(filter);
    if (!term) return sorted;
    return sorted.filter((tag) => slugifyTag(tag.label).includes(term) || tag.slug.includes(term));
  }, [sorted, filter]);

  // Every write ends the same way: report it, then reload the vocabulary rather
  // than patching the list in place, so the counts a merge just moved are the
  // database's and not this page's arithmetic.
  const run = async (
    work: () => Promise<{ error: string | null; message?: string }>,
    success: string,
  ) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    const result = await work();
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setNotice(result.message ?? success);
    reload();
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
          Only a full admin can edit the tag vocabulary. Reps can tag their own team&apos;s
          bobbleheads from a listing page.
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
            { label: "Manage tags" },
          ]}
        />
        <h1 className="mt-3 text-2xl font-black uppercase tracking-wide">Manage tags</h1>
        <p className="mt-1 text-sm text-zinc-600">
          The shared vocabulary behind{" "}
          <Link href="/tags" className="font-semibold text-accent hover:text-accent-hover">
            /tags
          </Link>
          . Rename one to fix how it reads, merge two that mean the same thing, or delete one for
          good — deleting takes it off every listing carrying it, merging doesn&apos;t.
        </p>

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tags…"
          className="mt-6 w-full rounded border border-black/15 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-accent focus:outline-none"
        />

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {notice ? <p className="mt-4 text-sm text-emerald-600">{notice}</p> : null}

        {isLoadingTags ? (
          <p className="mt-6 text-sm text-zinc-600">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600">
            {tags.length === 0 ? "No tags yet." : "No tag matches that."}
          </p>
        ) : (
          <>
            <p className="mt-6 text-xs font-black uppercase tracking-wide text-zinc-500">
              {shown.length} of {tags.length} {tags.length === 1 ? "tag" : "tags"}
            </p>
            <ul className="mt-2 divide-y divide-black/10 rounded-lg border border-black/10 bg-white">
              {shown.map((tag) => (
                <TagRow
                  key={tag.slug}
                  tag={tag}
                  others={sorted.filter((other) => other.slug !== tag.slug)}
                  busy={busy}
                  onRename={(label) =>
                    run(() => renameTag(supabase, tag.slug, label), `Renamed to ${label}.`)
                  }
                  onMerge={(intoSlug) =>
                    run(async () => {
                      const result = await mergeTags(supabase, {
                        fromSlug: tag.slug,
                        intoSlug,
                        createdBy: user.id,
                      });
                      const into = tags.find((other) => other.slug === intoSlug);

                      return {
                        ...result,
                        message: `Merged ${tag.label} into ${into?.label ?? intoSlug} — ${
                          result.moved
                        } ${result.moved === 1 ? "listing" : "listings"} moved.`,
                      };
                    }, "")
                  }
                  onDelete={() => run(() => deleteTag(supabase, tag.slug), `Deleted ${tag.label}.`)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
