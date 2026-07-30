"use client";

import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { tagHref } from "@/lib/tags";
import { useTagVocabulary } from "@/lib/useTags";

// The tag directory. Reads client-side rather than on the server because the
// vocabulary changes whenever a rep labels something, and a prerendered list
// would be a day behind the tag someone just made.

export function TagsPageClient() {
  const { tags, isLoading } = useTagVocabulary();
  const used = tags.filter((tag) => tag.listingCount > 0);

  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Tags" }]} />

        <h1 className="mt-4 font-display text-4xl font-bold uppercase tracking-wide text-navy">
          Tags
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
          The themes that cut across teams and seasons — a Star Wars bobblehead is a Star Wars
          bobblehead whoever gave it away.
        </p>

        {isLoading ? (
          <p className="mt-8 text-sm text-zinc-600">Loading…</p>
        ) : used.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-600">
            No tags yet. Admins and team reps can add them from a bobblehead&apos;s page.
          </p>
        ) : (
          <ul className="mt-8 flex flex-wrap gap-2">
            {used.map((tag) => (
              <li key={tag.slug}>
                <Link
                  href={tagHref(tag.slug)}
                  className="inline-flex items-center gap-2 rounded-full border border-brass/40 bg-brass/10 px-4 py-2 text-sm font-bold uppercase tracking-wide text-navy transition hover:border-accent hover:text-accent-hover"
                >
                  {tag.label}
                  <span className="text-xs font-semibold text-zinc-500">{tag.listingCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
