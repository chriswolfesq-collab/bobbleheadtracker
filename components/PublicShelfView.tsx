import Link from "next/link";
import DisplayCase from "@/components/DisplayCase";
import PublicGallery from "@/components/PublicGallery";
import type { PublicGalleryItem } from "@/lib/publicShelf";
import type { ShelfStats } from "@/lib/shelfStats";

// The visible body of a public /shelf/<slug> page, factored out so it can be
// rendered from two places with the exact same markup:
//   - app/shelf/[slug]/page.tsx, the real public page (server-fetched data)
//   - app/settings/preview, an owner-only "what does the public see?" preview
//     (the owner's own data, readable even while the shelf is private)
// Keeping it in one component is the whole point — a preview that drifted from
// the live page would be worse than no preview at all.
export type PublicShelfViewProps = {
  displayName: string;
  countByTeamSlug: Record<string, number>;
  totalByTeamSlug: Record<string, number>;
  stats: ShelfStats;
  galleryItems: PublicGalleryItem[];
};

export default function PublicShelfView({
  displayName,
  countByTeamSlug,
  totalByTeamSlug,
  stats,
  galleryItems,
}: PublicShelfViewProps) {
  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
        <header className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent/80 sm:text-xs">
            MLB Bobblehead Shelf
          </p>
          <h1 className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">{displayName}</h1>

          {/* The count is the point of the page: it's what gets posted, what a
              rival collector measures themselves against, and the reason they
              click through. Everything else is supporting detail. */}
          <p className="mt-6 text-7xl font-black leading-none tabular-nums text-accent sm:text-8xl">
            {stats.totalOwned}
          </p>
          <p className="mt-2 text-sm font-black uppercase tracking-[0.3em] text-zinc-700 dark:text-zinc-300">
            Bobbleheads
          </p>

          <div className="mx-auto mt-6 max-w-sm">
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${stats.pctComplete}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-bold text-zinc-500">
              {stats.totalOwned} of {stats.siteTotal} · {stats.pctComplete}% · {stats.teamsStarted}/
              {stats.teamCount} teams started
            </p>
          </div>
        </header>

        <div className="mt-8">
          <DisplayCase countByTeamSlug={countByTeamSlug} totalByTeamSlug={totalByTeamSlug} />
        </div>

        {/* Opt-in only: the gallery is empty unless the owner turned it on, so
            most shelves stay counts-only and render nothing here. */}
        {galleryItems.length > 0 ? (
          <PublicGallery displayName={displayName} items={galleryItems} />
        ) : null}

        {/* The whole reason the page is public. Whoever is reading this arrived
            from someone else's post, so the ask is to go build their own. */}
        <div className="mt-10 rounded-2xl border border-accent/30 bg-accent/5 p-6 text-center">
          <p className="text-lg font-black text-zinc-900 dark:text-white">Think your shelf beats this?</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
            Track every stadium giveaway bobblehead across all 30 teams, then put your own count up
            here.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-accent px-6 py-3 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover"
          >
            Build your shelf
          </Link>
        </div>
      </div>
    </div>
  );
}
