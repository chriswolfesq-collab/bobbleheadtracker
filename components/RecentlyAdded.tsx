"use client";

import Link from "next/link";
import { ShelfItem, ShelfRow } from "@/components/ShelfRow";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useRecentCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
import { publicAsset } from "@/lib/paths";
import { getTeamBySlug } from "@/lib/teams";

const RECENT_LIMIT = 10;
const CAPTION_HEIGHT = 64;

export default function RecentlyAdded() {
  const { communityBobbleheads, isLoading } = useRecentCommunityBobbleheads(RECENT_LIMIT);

  if (isLoading || communityBobbleheads.length === 0) {
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc}
                    alt={`${bobblehead.title} bobblehead`}
                    loading={isUnoptimizedImage(imageSrc) ? undefined : "lazy"}
                    className="h-24 w-auto max-w-32 object-contain mix-blend-multiply drop-shadow-[0_8px_8px_rgba(58,36,18,0.35)] transition hover:scale-105 sm:h-28"
                  />
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
