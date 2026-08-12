import Link from "next/link";
import { BobbleheadImage } from "@/components/BobbleheadImage";
import { WantedButton } from "@/components/WantedButton";
import type { CommunityBobbleheadWithTeam } from "@/lib/communityBobbleheads";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
import { publicAsset } from "@/lib/paths";
import { getTeamBySlug } from "@/lib/teams";

// The date the listing joined the catalog, short enough to sit under the
// giveaway date without crowding it. This is the field the page's newest/oldest
// sort runs on, so it has to be visible — with only the giveaway date on the
// card, sorting looked like it did nothing at all.
function formatAddedOn(iso: string): string | null {
  const added = new Date(iso);
  if (Number.isNaN(added.getTime())) return null;
  return added.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function RecentlyAddedCard({
  bobblehead,
  photoUrl,
  isWanted,
  isLoggedIn,
  onToggleWanted,
  onNavigate,
}: {
  bobblehead: CommunityBobbleheadWithTeam;
  /** admin-approved photo for this listing, which outranks the row's own */
  photoUrl?: string;
  isWanted: boolean;
  isLoggedIn: boolean;
  onToggleWanted: () => void;
  /** records the list being left, so the listing's arrows walk it */
  onNavigate?: () => void;
}) {
  const team = getTeamBySlug(bobblehead.teamSlug);
  const placeholderSrc = publicAsset(`/bobbleheads/${bobblehead.teamSlug}.png`);
  // Approved photo, then the listing's own, then the team silhouette — the
  // same order of preference the listing page applies.
  const imageSrc = photoUrl ?? bobblehead.imageUrl ?? placeholderSrc;
  const addedOn = formatAddedOn(bobblehead.createdAt);

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
        onClick={onNavigate}
        className="flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/* `relative` so BobbleheadImage's skeleton has a box to fill —
            without it these cards sit blank white until the photo arrives. */}
        <div className="relative flex h-24 items-end justify-center px-2 pt-2 sm:h-28">
          <BobbleheadImage
            src={imageSrc}
            fallbackSrc={placeholderSrc}
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
          {/* The giveaway date stays unlabelled and prominent — it's the one
              that describes the bobblehead. The added date sits under it,
              dimmer and prefixed, because it only exists to explain the sort. */}
          {bobblehead.date && bobblehead.date !== "N/A" ? (
            <p className="mt-0.5 truncate text-[9px] text-zinc-500 sm:text-[10px]">{bobblehead.date}</p>
          ) : null}
          {addedOn ? (
            <p className="mt-0.5 truncate text-[9px] text-zinc-400 sm:text-[10px]">
              Added {addedOn}
            </p>
          ) : null}
        </div>
      </Link>
    </div>
  );
}
