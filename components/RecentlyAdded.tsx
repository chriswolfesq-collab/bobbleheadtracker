"use client";

import Image from "next/image";
import Link from "next/link";
import { useRecentCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { publicAsset } from "@/lib/paths";
import { getTeamBySlug } from "@/lib/teams";

const RECENT_LIMIT = 10;

export default function RecentlyAdded() {
  const { communityBobbleheads, isLoading } = useRecentCommunityBobbleheads(RECENT_LIMIT);

  if (isLoading || communityBobbleheads.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-2 sm:px-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-500/80 sm:text-xs">
        Recently added by the community
      </h2>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {communityBobbleheads.map((bobblehead) => {
          const team = getTeamBySlug(bobblehead.teamSlug);
          const imageSrc = bobblehead.imageUrl ?? publicAsset(`/bobbleheads/${bobblehead.teamSlug}.png`);

          return (
            <Link
              key={bobblehead.id}
              href={`/teams/${bobblehead.teamSlug}/community?id=${encodeURIComponent(bobblehead.id)}`}
              className="group flex w-28 shrink-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#102032] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-amber-400/50 sm:w-32"
            >
              <div className="flex h-20 items-end justify-center bg-[radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.14),rgba(255,255,255,0)_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.22))] px-2 pt-2 sm:h-24">
                <Image
                  src={imageSrc}
                  alt={`${bobblehead.title} bobblehead`}
                  width={268}
                  height={630}
                  unoptimized={imageSrc.startsWith("http")}
                  className="h-16 w-auto object-contain drop-shadow-[0_8px_10px_rgba(0,0,0,0.6)] sm:h-20"
                />
              </div>
              <div className="border-t border-white/[0.04] bg-[#0d1a29]/70 px-2 py-2 text-center">
                <p className="truncate text-[10px] font-bold leading-tight text-white sm:text-[11px]">
                  {bobblehead.title}
                </p>
                <p className="mt-1 truncate text-[9px] uppercase tracking-wide text-zinc-400 sm:text-[10px]">
                  {team ? `${team.city} ${team.name}` : bobblehead.teamSlug}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
