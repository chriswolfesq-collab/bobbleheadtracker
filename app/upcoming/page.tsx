import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { UpcomingCard } from "@/components/UpcomingCard";
import { upcomingGiveaways } from "@/lib/giveawayFeed";

const title = "Upcoming Bobblehead Giveaways — BobbleShelf";
const description =
  "Every scheduled MLB stadium giveaway bobblehead still to come, soonest first, across all 30 teams.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/upcoming" },
  openGraph: { title, description, type: "website", url: "/upcoming" },
};

// Same ceiling as the homepage: the page is otherwise static, but a giveaway
// has to drop off the list the day after it happens.
export const revalidate = 3600;

// "April 2026" — the strip's cards carry the weekday and day, so the heading
// only has to say which month you've scrolled into.
function monthLabel(time: number): string {
  return new Date(time).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default async function UpcomingPage() {
  // No limit: this is the page the homepage strip's twelve are a preview of.
  const { items, now } = await upcomingGiveaways();

  // Already sorted soonest-first, so a month's entries are contiguous and this
  // only has to notice when the label changes.
  const months: Array<{ label: string; items: typeof items }> = [];
  for (const item of items) {
    const label = monthLabel(item.time);
    const current = months.at(-1);
    if (current?.label === label) current.items.push(item);
    else months.push({ label, items: [item] });
  }

  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <BreadcrumbJsonLd trail={[{ name: "Upcoming", path: "/upcoming" }]} />

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <Breadcrumbs className="mb-6" items={[{ href: "/", label: "Home" }, { label: "Upcoming" }]} />

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brass">
              On the schedule
            </p>
            <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-navy">
              Upcoming
            </h1>
          </div>
          <Link
            href="/giveaways.ics"
            className="shrink-0 pb-0.5 text-sm font-semibold text-accent transition hover:text-accent-hover"
          >
            Add to calendar <span aria-hidden>→</span>
          </Link>
        </div>

        {items.length === 0 ? (
          // Between seasons there is genuinely nothing ahead. Say so, rather
          // than leaving a heading over an empty page.
          <p className="mt-8 rounded-xl border border-border-soft bg-surface p-6 text-sm leading-6 text-zinc-600">
            Nothing on the schedule right now. Next season&apos;s giveaway dates land here as soon
            as clubs announce them.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-zinc-600">
              {items.length} scheduled giveaway{items.length === 1 ? "" : "s"}, soonest first.
            </p>

            {months.map((month) => (
              <section key={month.label} className="mt-10">
                <h2 className="font-display text-xl font-bold uppercase tracking-wide text-navy">
                  {month.label}
                </h2>
                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {month.items.map((item) => (
                    <li key={`${item.teamSlug}:${item.id}`}>
                      <UpcomingCard item={item} now={now} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
