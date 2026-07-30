import { buildIcs } from "@/lib/giveawayCalendar";
import { toCalendarEvents, upcomingGiveaways } from "@/lib/giveawayFeed";

// Every upcoming giveaway across all 30 teams, as a calendar you subscribe to
// once. See app/teams/[slug]/giveaways.ics for the single-team feed, which is
// the one most people actually want.

export async function GET() {
  const { items, now } = await upcomingGiveaways();

  const body = buildIcs({
    name: "MLB bobblehead giveaways",
    description: "Upcoming stadium giveaway bobbleheads, from BobbleShelf.",
    events: toCalendarEvents(items),
    now,
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // inline, not attachment: a calendar client following a subscription URL
      // should read the feed, not hand the user a file to save.
      "Content-Disposition": 'inline; filename="bobbleshelf-giveaways.ics"',
      // Calendar clients poll on their own schedule and the underlying dates
      // barely move; an hour keeps a hot feed off the origin without letting a
      // newly added giveaway go stale for long.
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
