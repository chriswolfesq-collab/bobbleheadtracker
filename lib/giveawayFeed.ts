import { GIVEAWAYS_BY_TEAM, type Giveaway } from "@/lib/bobbleheads";
import { bobbleheadHref } from "@/lib/bobbleheadIdentity";
import type { BobbleheadOverride } from "@/lib/bobbleheadOverrides";
import { getCommunityListings, type CommunityListingRow } from "@/lib/communityServer";
import { getApprovedPhotos, getListingOverrides } from "@/lib/curatedListing";
import type { CalendarEvent } from "@/lib/giveawayCalendar";
import { siteUrl } from "@/lib/siteUrl";
import { getTeamBySlug } from "@/lib/teams";
import { selectUpcoming, type UpcomingGiveaway } from "@/lib/upcomingGiveaways";

// The server-side half of "what's coming up": every listing the site knows
// about, from the same three sources a team page assembles — the curated
// catalog, the admin edits layered over it, and the approved community
// listings. Shared so the strip and the .ics feed can't disagree about what's
// on the schedule.

export type ScheduleEntry = Giveaway & { teamSlug: string; isCurated: boolean };

function listingKey(teamSlug: string, bobbleheadId: string) {
  return `${teamSlug}/${bobbleheadId}`;
}

// Everything on the schedule, before the date filter. Pure, so the merge can be
// tested without a database: the callers hand it the three sources.
//
// The curated catalog is baked into the bundle at build time, so a date an
// admin fixed lives in bobblehead_overrides and a listing a user added lives in
// community_bobbleheads — neither is in the catalog. Reading the catalog alone
// (which this did) meant the only giveaways that could ever appear were the
// ones shipped in the last deploy, so every newly announced date was missing
// from the strip, the /upcoming page and both calendar feeds.
export function scheduleEntries({
  overrides,
  photos,
  community,
  teamSlug,
}: {
  overrides: Record<string, BobbleheadOverride>;
  photos: Record<string, string>;
  community: CommunityListingRow[];
  /** One team, or every team when omitted. */
  teamSlug?: string;
}): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];

  for (const [slug, giveaways] of Object.entries(GIVEAWAYS_BY_TEAM)) {
    if (teamSlug && slug !== teamSlug) continue;

    for (const giveaway of giveaways) {
      const key = listingKey(slug, giveaway.id);
      const override = overrides[key];
      if (override?.deleted) continue;

      entries.push({
        ...giveaway,
        title: override?.title ?? giveaway.title,
        nickname: override?.nickname ?? giveaway.nickname ?? null,
        quantity: override?.quantity ?? giveaway.quantity ?? null,
        year: override?.year ?? giveaway.year,
        date: override?.date ?? giveaway.date,
        // Same fallback order as the team page: an approved photo wins, a
        // removed seed photo leaves nothing behind, and the card draws the
        // team placeholder instead.
        imageUrl: photos[key] ?? (override?.photoHidden ? null : (giveaway.imageUrl ?? null)),
        teamSlug: slug,
        isCurated: true,
      });
    }
  }

  for (const listing of community) {
    if (teamSlug && listing.teamSlug !== teamSlug) continue;

    entries.push({
      ...listing,
      imageUrl: photos[listingKey(listing.teamSlug, listing.id)] ?? listing.imageUrl ?? null,
      // A community listing has no curated detail page; its card has to route
      // through the community view instead.
      isCurated: false,
    });
  }

  return entries;
}

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
  const [overrides, photos, community] = await Promise.all([
    getListingOverrides(),
    getApprovedPhotos(),
    getCommunityListings(),
  ]);

  const entries = scheduleEntries({ overrides, photos, community, teamSlug });

  return { items: selectUpcoming(entries, now, limit), now };
}

export function toCalendarEvents(items: UpcomingGiveaway[]): CalendarEvent[] {
  const base = siteUrl();

  return items.map((item) => {
    const team = getTeamBySlug(item.teamSlug);
    const teamName = team ? `${team.city} ${team.name}` : item.teamSlug;
    const url = `${base}${bobbleheadHref(item.teamSlug, item.id, item.isCurated)}`;

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
