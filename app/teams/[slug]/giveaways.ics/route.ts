import { buildIcs } from "@/lib/giveawayCalendar";
import { toCalendarEvents, upcomingGiveaways } from "@/lib/giveawayFeed";
import { getTeamBySlug } from "@/lib/teams";

// One team's upcoming giveaways as a subscribable calendar. Most people follow
// one club, so this is the feed the team page links to; app/giveaways.ics is
// the all-teams version.

export async function GET(_request: Request, ctx: RouteContext<"/teams/[slug]/giveaways.ics">) {
  const { slug } = await ctx.params;
  const team = getTeamBySlug(slug);

  if (!team) return new Response("Not found", { status: 404 });

  const { items, now } = await upcomingGiveaways({ teamSlug: slug });
  const teamName = `${team.city} ${team.name}`;

  const body = buildIcs({
    name: `${teamName} bobblehead giveaways`,
    description: `Upcoming ${teamName} stadium giveaway bobbleheads, from BobbleShelf.`,
    events: toCalendarEvents(items),
    now,
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="bobbleshelf-${slug}.ics"`,
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
