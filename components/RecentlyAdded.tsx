"use client";

import { RecentlyAddedCard } from "@/components/RecentlyAddedCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
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
    <div>
      <SectionHeading
        title="Recently Added"
        eyebrow="By the community"
        viewAllHref="/recently-added"
      />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
    </div>
  );
}
