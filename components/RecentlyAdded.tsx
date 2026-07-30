"use client";

import Link from "next/link";
import { BobbleheadImage } from "@/components/BobbleheadImage";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useRecentCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
import { publicAsset } from "@/lib/paths";
import { getTeamBySlug } from "@/lib/teams";

// The community's newest additions, in the same card scroller the "Coming Up"
// strip uses next door — the two sit near each other on the homepage and read
// as one pair of feeds: what's landed, what's ahead.

const RECENT_LIMIT = 10;

const CARD =
  "flex h-full flex-col overflow-hidden rounded-xl border border-border-soft bg-surface";
const PANEL =
  "relative flex h-28 items-end justify-center bg-[radial-gradient(circle_at_50%_18%,#ffffff,#f2ead9_78%)] pt-3";

export default function RecentlyAdded({ className }: { className?: string }) {
  const { communityBobbleheads, isLoading } = useRecentCommunityBobbleheads(RECENT_LIMIT);

  // Rendering nothing while the fetch is in flight pulled the heading and the
  // whole row out of the page, so everything below sat higher and then jumped
  // down when the data landed. This placeholder row has the loaded row's exact
  // footprint.
  if (isLoading) {
    return (
      <section className={className} aria-label="Recently Added">
        <Heading />
        <ul className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2">
          {Array.from({ length: RECENT_LIMIT }, (_, index) => (
            <li key={`placeholder-${index}`} className="w-44 shrink-0 snap-start sm:w-48">
              <div className={CARD} aria-hidden>
                <div className={PANEL}>
                  <span className="absolute inset-0 animate-pulse bg-black/[0.06]" />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <span className="h-3 w-16 animate-pulse rounded bg-black/[0.06]" />
                  <span className="h-4 w-full animate-pulse rounded bg-black/[0.06]" />
                  <span className="h-3 w-24 animate-pulse rounded bg-black/[0.06]" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (communityBobbleheads.length === 0) {
    return null;
  }

  return (
    <section className={className} aria-label="Recently Added">
      <Heading />

      {/* A scroller rather than a grid, to match the strip next door: the list
          is ordered newest-first and a wrapping grid would put last month's
          addition above one from this morning. */}
      <ul className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2">
        {communityBobbleheads.map((bobblehead) => {
          const team = getTeamBySlug(bobblehead.teamSlug);
          const imageSrc =
            bobblehead.imageUrl ?? publicAsset(`/bobbleheads/${bobblehead.teamSlug}.png`);
          const href = `/teams/${bobblehead.teamSlug}/community/${encodeURIComponent(bobblehead.id)}`;

          return (
            <li
              key={`${bobblehead.teamSlug}-${bobblehead.id}`}
              className="w-44 shrink-0 snap-start sm:w-48"
            >
              <Link
                href={href}
                className={`group ${CARD} transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
              >
                <div className={PANEL}>
                  <BobbleheadImage
                    src={imageSrc}
                    alt={`${bobblehead.title} bobblehead`}
                    width={268}
                    height={630}
                    unoptimized={isUnoptimizedImage(imageSrc)}
                    // Keeps the previous loading split: hosts we don't route
                    // through the optimizer load eagerly, the rest stay lazy
                    // so ten remote photos don't compete with the hero.
                    eager={isUnoptimizedImage(imageSrc)}
                    className="h-24 w-auto object-contain mix-blend-multiply drop-shadow-[0_8px_8px_rgba(58,36,18,0.3)]"
                  />
                </div>

                <div className="flex flex-1 flex-col gap-1 p-3">
                  {bobblehead.date && bobblehead.date !== "N/A" ? (
                    <p className="text-[11px] font-black uppercase tracking-wide text-accent">
                      {bobblehead.date}
                    </p>
                  ) : null}
                  <p className="font-display text-sm font-bold uppercase leading-tight tracking-wide text-navy">
                    {bobblehead.title}
                  </p>
                  {team ? (
                    <p className="mt-auto text-xs text-zinc-500">
                      {team.city} {team.name}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Heading() {
  return (
    <SectionHeading
      eyebrow="From the community"
      title="Recently Added"
      viewAllHref="/recently-added"
    />
  );
}
