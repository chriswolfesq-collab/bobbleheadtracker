import Image from "next/image";
import Link from "next/link";
import { WantedButton } from "@/components/WantedButton";
import type { CommunityBobbleheadWithTeam } from "@/lib/communityBobbleheads";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
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
    <div className="group relative overflow-hidden rounded-lg border border-black/10 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-accent/50">
      <WantedButton
        isWanted={isWanted}
        isLoggedIn={isLoggedIn}
        onToggle={onToggleWanted}
        className="absolute right-1.5 top-1.5 z-10 h-5 w-5 text-xs"
      />

      <Link
        href={`/teams/${bobblehead.teamSlug}/community/${encodeURIComponent(bobblehead.id)}`}
        className="flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="flex h-24 items-end justify-center px-2 pt-2 sm:h-28">
          <Image
            src={imageSrc}
            alt={`${bobblehead.title} bobblehead`}
            width={268}
            height={630}
            unoptimized={isUnoptimizedImage(imageSrc)}
            className="h-20 w-auto object-contain mix-blend-multiply drop-shadow-[0_8px_10px_rgba(58,36,18,0.35)] sm:h-24"
          />
        </div>
        <div className="px-2 py-2 text-center">
          <p className="truncate text-[10px] font-bold leading-tight text-zinc-900 sm:text-[11px]">
            {bobblehead.title}
          </p>
          <p className="mt-1 truncate text-[9px] uppercase tracking-wide text-zinc-600 sm:text-[10px]">
            {team ? `${team.city} ${team.name}` : bobblehead.teamSlug}
          </p>
          {bobblehead.date && bobblehead.date !== "N/A" ? (
            <p className="mt-0.5 truncate text-[9px] text-zinc-500 sm:text-[10px]">{bobblehead.date}</p>
          ) : null}
        </div>
      </Link>
    </div>
  );
}
