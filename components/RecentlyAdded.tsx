"use client";

import Link from "next/link";
import { RecentlyAddedCard } from "@/components/RecentlyAddedCard";
import { useRecentCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { useMyWantedLookup } from "@/lib/userWanted";

const RECENT_LIMIT = 10;

export default function RecentlyAdded() {
  const { communityBobbleheads, isLoading } = useRecentCommunityBobbleheads(RECENT_LIMIT);
  const { wantedByKey, isLoggedIn, setWanted } = useMyWantedLookup();

  if (isLoading || communityBobbleheads.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 pb-2 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-500/80 sm:text-xs">
          Recently added by the community
        </h2>
        <Link
          href="/recently-added"
          className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 transition hover:text-amber-300"
        >
          View more
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {communityBobbleheads.map((bobblehead) => {
          const key = `${bobblehead.teamSlug}:${bobblehead.id}`;
          return (
            <RecentlyAddedCard
              key={bobblehead.id}
              bobblehead={bobblehead}
              isWanted={wantedByKey[key] ?? false}
              isLoggedIn={isLoggedIn}
              onToggleWanted={() => setWanted(bobblehead.teamSlug, bobblehead.id, !(wantedByKey[key] ?? false))}
            />
          );
        })}
      </div>
    </section>
  );
}
