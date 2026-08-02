import Image from "next/image";
import Link from "next/link";
import { bobbleheadHref } from "@/lib/bobbleheadIdentity";
import { publicAsset } from "@/lib/paths";
import { getTeamBySlug } from "@/lib/teams";
import { formatCountdown, formatUpcomingDate, type UpcomingGiveaway } from "@/lib/upcomingGiveaways";

// One scheduled giveaway as a card. Shared by the homepage strip and the full
// /upcoming list so the two can't drift apart — they're the same list, one
// truncated.

export function UpcomingCard({ item, now }: { item: UpcomingGiveaway; now: number }) {
  const team = getTeamBySlug(item.teamSlug);
  const imageSrc = item.imageUrl ?? publicAsset(`/bobbleheads/${item.teamSlug}.png`);

  return (
    // A community-submitted giveaway has no curated detail page, so its card
    // opens the community view instead.
    <Link
      href={bobbleheadHref(item.teamSlug, item.id, item.isCurated)}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border-soft bg-surface transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex h-28 items-end justify-center bg-[radial-gradient(circle_at_50%_18%,#ffffff,#f2ead9_78%)] pt-3">
        <Image
          src={imageSrc}
          alt=""
          width={135}
          height={321}
          // Decorative: the title underneath already names it, and a
          // placeholder team figure has nothing to describe.
          aria-hidden
          unoptimized={imageSrc.startsWith("http")}
          className="h-24 w-auto object-contain mix-blend-multiply drop-shadow-[0_8px_8px_rgba(58,36,18,0.3)]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-[11px] font-black uppercase tracking-wide text-accent">
          {formatUpcomingDate(item.time)}
          <span className="ml-1.5 font-semibold text-zinc-500">
            {formatCountdown(item.time, now)}
          </span>
        </p>
        <p className="font-display text-sm font-bold uppercase leading-tight tracking-wide text-navy">
          {item.title}
        </p>
        {team ? (
          <p className="mt-auto text-xs text-zinc-500">
            {team.city} {team.name}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
