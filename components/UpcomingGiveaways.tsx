import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { bobbleheadHref } from "@/lib/bobbleheadIdentity";
import { publicAsset } from "@/lib/paths";
import { getTeamBySlug } from "@/lib/teams";
import { formatCountdown, formatUpcomingDate, type UpcomingGiveaway } from "@/lib/upcomingGiveaways";

// The "coming up" strip. Every other list on the site looks backwards at what
// was given away; this is the one that looks forward, off the same curated
// dates. Server-rendered — the data is in the bundle already and the only
// moving part is which day it is.
//
// Renders nothing at all when nothing is scheduled, rather than an empty shelf
// with a heading over it. Between seasons that's the honest answer.

export function UpcomingGiveaways({
  items,
  now,
  title = "Coming Up",
  calendarHref,
  className,
}: {
  items: UpcomingGiveaway[];
  /** Passed in so the countdown agrees with whatever selected these. */
  now: number;
  title?: string;
  /** The .ics feed for this list, offered beside the heading. */
  calendarHref?: string;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className={className} aria-label={title}>
      <SectionHeading
        eyebrow="On the schedule"
        title={title}
        viewAllHref={calendarHref}
        viewAllLabel="Add to calendar"
      />

      {/* A scroller rather than a grid: the list is naturally ordered by date,
          and a wrapping grid would put next week's giveaway underneath one in
          September. */}
      <ul className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2">
        {items.map((item) => {
          const team = getTeamBySlug(item.teamSlug);
          const imageSrc = item.imageUrl ?? publicAsset(`/bobbleheads/${item.teamSlug}.png`);

          return (
            <li key={`${item.teamSlug}:${item.id}`} className="w-44 shrink-0 snap-start sm:w-48">
              {/* Curated listings only: the schedule this reads is the curated
                  catalog, so there's never a community id to route here. */}
              <Link
                href={bobbleheadHref(item.teamSlug, item.id, true)}
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
