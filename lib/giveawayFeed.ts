import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";
import { bobbleheadHref } from "@/lib/bobbleheadIdentity";
import { getDeletedListingKeys } from "@/lib/curatedListing";
import type { CalendarEvent } from "@/lib/giveawayCalendar";
import { siteUrl } from "@/lib/siteUrl";
import { getTeamBySlug } from "@/lib/teams";
import { selectUpcoming, type UpcomingGiveaway } from "@/lib/upcomingGiveaways";

// The server-side half of "what's coming up": the same selection the homepage
// and team pages render, minus anything an admin has deleted. Shared so the
// strip and the .ics feed can't disagree about what's on the schedule.

// Returns the clock it used alongside the results. Reading the time is impure,
// which a React component isn't allowed to be — so the caller takes `now` back
// from here rather than calling Date.now() in its own body, and the countdown
// on screen is guaranteed to be measured against the same instant that decided
// what's on the list.
export async function upcomingGiveaways({
  teamSlug,
  now = Date.now(),
  limit,
}: {
  /** One team, or every team when omitted. */
  teamSlug?: string;
  now?: number;
  limit?: number;
} = {}): Promise<{ items: UpcomingGiveaway[]; now: number }> {
  const deleted = await getDeletedListingKeys();

  const entries = Object.entries(GIVEAWAYS_BY_TEAM)
    .filter(([slug]) => !teamSlug || slug === teamSlug)
    .flatMap(([slug, giveaways]) =>
      giveaways
        .filter((giveaway) => !deleted.has(`${slug}/${giveaway.id}`))
        .map((giveaway) => ({ ...giveaway, teamSlug: slug })),
    );

  return { items: selectUpcoming(entries, now, limit), now };
}

export function toCalendarEvents(items: UpcomingGiveaway[]): CalendarEvent[] {
  const base = siteUrl();

  return items.map((item) => {
    const team = getTeamBySlug(item.teamSlug);
    const teamName = team ? `${team.city} ${team.name}` : item.teamSlug;
    const url = `${base}${bobbleheadHref(item.teamSlug, item.id, true)}`;

    return {
      // Stable per listing and namespaced to the site, so a client refreshing
      // the feed updates the event it already has instead of adding a second
      // copy of the whole season.
      uid: `${item.teamSlug}-${item.id}@bobbleshelf.com`,
      time: item.time,
      summary: `${item.title} bobblehead — ${teamName}`,
      description: `${teamName} stadium giveaway.${
        item.quantity?.trim() ? ` ${item.quantity} issued.` : ""
      }\n${url}`,
      url,
    };
  });
}
