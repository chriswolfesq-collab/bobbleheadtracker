import { UpcomingCard } from "@/components/UpcomingCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { UpcomingGiveaway } from "@/lib/upcomingGiveaways";

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
  viewAllHref,
  viewAllLabel,
  className,
}: {
  items: UpcomingGiveaway[];
  /** Passed in so the countdown agrees with whatever selected these. */
  now: number;
  title?: string;
  /** The full list this strip is a preview of. */
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className={className} aria-label={title}>
      <SectionHeading
        eyebrow="On the schedule"
        title={title}
        viewAllHref={viewAllHref}
        viewAllLabel={viewAllLabel}
      />

      {/* A scroller rather than a grid: the list is naturally ordered by date,
          and a wrapping grid would put next week's giveaway underneath one in
          September. */}
      <ul className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2">
        {items.map((item) => (
          <li
            key={`${item.teamSlug}:${item.id}`}
            className="w-44 shrink-0 snap-start sm:w-48"
          >
            <UpcomingCard item={item} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}
