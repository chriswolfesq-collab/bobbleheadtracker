"use client";

import Link from "next/link";
import { BobbleheadImage } from "@/components/BobbleheadImage";
import { ShelfItem, ShelfRow } from "@/components/ShelfRow";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useRecentCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
import { publicAsset } from "@/lib/paths";
import { getTeamBySlug } from "@/lib/teams";

const RECENT_LIMIT = 10;
const CAPTION_HEIGHT = 64;

// The caption below each figure is w-32 and the figure itself is capped at
// max-w-32, so an item measures 128px whether or not its photo has arrived.
// Giving the figure that box outright costs no layout and gives
// BobbleheadImage's skeleton (absolute inset-0) something to fill — without it
// the figures are simply missing from the plank while they load.
const FIGURE_BOX = "relative flex h-24 w-32 items-end justify-center sm:h-28";

function FigureSkeleton() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 animate-pulse rounded bg-black/[0.06]"
    />
  );
}

export default function RecentlyAdded() {
  const { communityBobbleheads, isLoading } = useRecentCommunityBobbleheads(RECENT_LIMIT);

  // Rendering nothing while the fetch is in flight pulled the heading and the
  // whole plank out of the page, so everything below sat higher and then jumped
  // down when the data landed. This placeholder row has the loaded row's exact
  // footprint, and its skeletons are the same ones the figures fall back to.
  if (isLoading) {
    return (
      <div>
        <SectionHeading title="Recently Added" viewAllHref="/recently-added" />
        <ShelfRow captionHeight={CAPTION_HEIGHT} className="mt-6">
          {Array.from({ length: RECENT_LIMIT }, (_, index) => (
            <ShelfItem
              key={`placeholder-${index}`}
              captionHeight={CAPTION_HEIGHT}
              visual={
                <div className={FIGURE_BOX}>
                  <FigureSkeleton />
                </div>
              }
              caption={<div aria-hidden className="w-32" />}
            />
          ))}
        </ShelfRow>
      </div>
    );
  }

  if (communityBobbleheads.length === 0) {
    return null;
  }

  return (
    <div>
      <SectionHeading title="Recently Added" viewAllHref="/recently-added" />
      <ShelfRow captionHeight={CAPTION_HEIGHT} className="mt-6">
        {communityBobbleheads.map((bobblehead) => {
          const team = getTeamBySlug(bobblehead.teamSlug);
          const imageSrc =
            bobblehead.imageUrl ?? publicAsset(`/bobbleheads/${bobblehead.teamSlug}.png`);
          return (
            <ShelfItem
              key={`${bobblehead.teamSlug}-${bobblehead.id}`}
              captionHeight={CAPTION_HEIGHT}
              visual={
                <Link
                  href={`/teams/${bobblehead.teamSlug}/community/${encodeURIComponent(bobblehead.id)}`}
                  className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className={FIGURE_BOX}>
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
                      className="h-24 w-auto max-w-32 object-contain mix-blend-multiply drop-shadow-[0_8px_8px_rgba(58,36,18,0.35)] transition hover:scale-105 sm:h-28"
                    />
                  </div>
                </Link>
              }
              caption={
                <Link
                  href={`/teams/${bobblehead.teamSlug}/community/${encodeURIComponent(bobblehead.id)}`}
                  className="w-32 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <p className="truncate text-xs font-bold text-navy">{bobblehead.title}</p>
                  <p className="truncate text-[10px] uppercase tracking-wide text-zinc-600">
                    {team ? `${team.city} ${team.name}` : bobblehead.teamSlug}
                  </p>
                  {bobblehead.date && bobblehead.date !== "N/A" ? (
                    <p className="truncate text-[10px] text-zinc-500">{bobblehead.date}</p>
                  ) : null}
                </Link>
              }
            />
          );
        })}
      </ShelfRow>
    </div>
  );
}
