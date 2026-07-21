import Image from "next/image";
import Link from "next/link";
import { WantedButton } from "@/components/WantedButton";
import type { CommunityBobbleheadWithTeam } from "@/lib/communityBobbleheads";
import { publicAsset } from "@/lib/paths";
import { getTeamBySlug } from "@/lib/teams";

export function RecentlyAddedCard({
  bobblehead,
  isWanted,
  isLoggedIn,
  onToggleWanted,
}: {
  bobblehead: CommunityBobbleheadWithTeam;
  isWanted: boolean;
  isLoggedIn: boolean;
  onToggleWanted: () => void;
}) {
  const team = getTeamBySlug(bobblehead.teamSlug);
  const imageSrc = bobblehead.imageUrl ?? publicAsset(`/bobbleheads/${bobblehead.teamSlug}.png`);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-black/10 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-accent/50 dark:border-white/10 dark:bg-[#102032]">
      <WantedButton
        isWanted={isWanted}
        isLoggedIn={isLoggedIn}
        onToggle={onToggleWanted}
        className="absolute right-1.5 top-1.5 z-10 h-5 w-5 text-xs"
      />

      <Link
        href={`/teams/${bobblehead.teamSlug}/community?id=${encodeURIComponent(bobblehead.id)}`}
        className="flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
        <div className="border-t border-black/[0.06] bg-slate-50 px-2 py-2 text-center dark:border-white/[0.04] dark:bg-[#0d1a29]/70">
          <p className="truncate text-[10px] font-bold leading-tight text-zinc-900 sm:text-[11px] dark:text-white">
            {bobblehead.title}
          </p>
          <p className="mt-1 truncate text-[9px] uppercase tracking-wide text-zinc-600 sm:text-[10px] dark:text-zinc-400">
            {team ? `${team.city} ${team.name}` : bobblehead.teamSlug}
          </p>
        </div>
      </Link>
    </div>
  );
}
