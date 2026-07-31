"use client";

import Link from "next/link";
import { BobbleheadImage } from "@/components/BobbleheadImage";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
import { publicAsset } from "@/lib/paths";
import { tagCompletionPercent, tagHref } from "@/lib/tags";
import { type TagDirectoryEntry, useTagDirectory } from "@/lib/useTags";

// The tag directory. Reads client-side rather than on the server because the
// vocabulary changes whenever a rep labels something, and a prerendered list
// would be a day behind the tag someone just made.
//
// A list rather than a wall of chips, because a label alone doesn't teach you
// what it collects — "Sugar Skull" and "Turn Ahead the Clock" mean nothing
// until you've seen one. Each row carries an example bobblehead, and, for a
// signed-in reader, how much of that tag they've already got.

function ExamplePhoto({ entry }: { entry: TagDirectoryEntry }) {
  const example = entry.example;
  const placeholder = example ? publicAsset(`/bobbleheads/${example.teamSlug}.png`) : null;

  return (
    <div className="relative flex h-20 w-16 shrink-0 items-end justify-center overflow-hidden rounded-lg border border-border-soft bg-[radial-gradient(circle_at_50%_18%,#ffffff,#f2ead9_78%)] pt-2 sm:h-24 sm:w-20">
      {example && placeholder ? (
        <BobbleheadImage
          src={example.imageUrl ?? placeholder}
          fallbackSrc={placeholder}
          // The name of the example is spelled out in the row's text, so the
          // photo is decoration to a screen reader rather than a second copy.
          alt=""
          aria-hidden
          width={135}
          height={321}
          unoptimized={isUnoptimizedImage(example.imageUrl)}
          className="h-[72px] w-auto object-contain mix-blend-multiply drop-shadow-[0_6px_6px_rgba(58,36,18,0.3)] sm:h-[88px]"
        />
      ) : null}
    </div>
  );
}

function TagProgress({ entry, isKnown }: { entry: TagDirectoryEntry; isKnown: boolean }) {
  const percent = isKnown ? tagCompletionPercent(entry.ownedCount, entry.listingCount) : null;

  return (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1">
      <ProgressRing percent={percent} size={44} strokeWidth={4} />
      <p className="text-[11px] font-semibold tabular-nums text-zinc-600">
        {isKnown ? `${entry.ownedCount} of ${entry.listingCount}` : "—"}
      </p>
    </div>
  );
}

export function TagsPageClient() {
  const { entries, isLoading, isProgressKnown, isLoggedIn } = useTagDirectory();
  const used = entries.filter((entry) => entry.listingCount > 0);

  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Tags" }]} />

        <h1 className="mt-4 font-display text-4xl font-bold uppercase tracking-wide text-navy">
          Tags
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
          The themes that cut across teams and seasons — a Star Wars bobblehead is a Star Wars
          bobblehead whoever gave it away. Each one shows an example of what it collects.
        </p>

        {isLoading ? (
          <p className="mt-8 text-sm text-zinc-600">Loading…</p>
        ) : used.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-600">
            No tags yet. Admins and team reps can add them from a bobblehead&apos;s page.
          </p>
        ) : (
          <>
            {isLoggedIn ? null : (
              <p className="mt-6 rounded-lg border border-border-soft bg-surface px-4 py-3 text-sm text-zinc-600">
                Log in to track how many of each tag you&apos;ve collected.
              </p>
            )}

            <ul className="mt-8 space-y-3">
              {used.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={tagHref(entry.slug)}
                    className="group flex items-center gap-4 rounded-xl border border-border-soft bg-white p-3 shadow-sm transition hover:border-accent hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <ExamplePhoto entry={entry} />

                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-bold uppercase leading-tight tracking-wide text-navy transition group-hover:text-accent-hover">
                        {entry.label}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-zinc-600">
                        {entry.listingCount}{" "}
                        {entry.listingCount === 1 ? "bobblehead" : "bobbleheads"}
                      </p>
                      {entry.example ? (
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          For example: {entry.example.title}
                        </p>
                      ) : null}
                    </div>

                    {isLoggedIn ? <TagProgress entry={entry} isKnown={isProgressKnown} /> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
