import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";
import { normalizeTitle, scrapeAll, type ScrapeCandidate } from "@/lib/giveawayScraper";
import { PROMO_SOURCES } from "@/lib/promoSources";
import { createServiceSupabase } from "@/lib/supabaseService";

// Scheduled giveaway scraper, triggered by Vercel Cron (see vercel.json).
// Crawls each team's promo-schedule page (lib/promoSources.ts), extracts
// bobblehead giveaways it hasn't seen, and drafts the genuinely new ones into
// the scraped_giveaways queue the admin works through at
// /admin/scraped-giveaways. Guarded by the same shared secret as the dead-image
// sweep: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically,
// and the same header lets an admin trigger a run by hand.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Team + normalized-title + year: the identity we use to decide a candidate is
// already a known listing (curated JSON or community) and shouldn't be drafted.
function listingKey(teamSlug: string, title: string, year: string): string {
  return `${teamSlug}|${normalizeTitle(title)}|${year}`;
}

function candidateKey(c: ScrapeCandidate): string {
  return listingKey(c.teamSlug, c.title, c.year);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const client = createServiceSupabase();
  const defaultYear = String(new Date().getFullYear());

  const { candidates, errors } = await scrapeAll(PROMO_SOURCES, { defaultYear });

  // Build the set of listings that already exist, so we only draft new ones.
  // 1. Curated giveaways from the bundled JSON.
  const existing = new Set<string>();
  for (const [teamSlug, giveaways] of Object.entries(GIVEAWAYS_BY_TEAM)) {
    for (const giveaway of giveaways) existing.add(listingKey(teamSlug, giveaway.title, giveaway.year));
  }

  // 2. Community listings already in the DB (including ones a previous scrape
  //    approved).
  const { data: community, error: communityError } = await client
    .from("community_bobbleheads")
    .select("team_slug, title, year");
  if (communityError) {
    return Response.json({ error: `community read failed: ${communityError.message}` }, { status: 500 });
  }
  for (const row of community ?? []) existing.add(listingKey(row.team_slug, row.title, row.year));

  const fresh = candidates.filter((c) => !existing.has(candidateKey(c)));
  const existingSkipped = candidates.length - fresh.length;

  // Diff against what's already in the queue by (team_slug, dedupe_key): brand
  // new candidates get inserted as 'pending'; ones we've queued before just get
  // their last_seen_at bumped, leaving any admin decision (approved/dismissed)
  // untouched so a re-run never resurrects a reviewed draft.
  const { data: queued, error: queuedError } = await client
    .from("scraped_giveaways")
    .select("id, team_slug, dedupe_key");
  if (queuedError) {
    return Response.json({ error: `queue read failed: ${queuedError.message}` }, { status: 500 });
  }

  const queuedIdByKey = new Map<string, string>();
  for (const row of queued ?? []) queuedIdByKey.set(`${row.team_slug}/${row.dedupe_key}`, row.id);

  const nowIso = new Date().toISOString();
  const toInsert: Record<string, unknown>[] = [];
  const toTouch: string[] = [];

  // Dedupe fresh candidates by (team, dedupe_key) so a single insert batch can't
  // trip the table's unique constraint on the same key twice.
  const freshByKey = new Map<string, ScrapeCandidate>();
  for (const c of fresh) freshByKey.set(`${c.teamSlug}/${c.dedupeKey}`, c);

  for (const [key, c] of freshByKey) {
    const existingId = queuedIdByKey.get(key);
    if (existingId) {
      toTouch.push(existingId);
    } else {
      toInsert.push({
        team_slug: c.teamSlug,
        title: c.title,
        year: c.year,
        date: c.date,
        source_url: c.sourceUrl,
        detected_text: c.detectedText,
        dedupe_key: c.dedupeKey,
        status: "pending",
        first_seen_at: nowIso,
        last_seen_at: nowIso,
      });
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await client.from("scraped_giveaways").insert(toInsert);
    if (insertError) {
      return Response.json({ error: `insert failed: ${insertError.message}` }, { status: 500 });
    }
  }

  if (toTouch.length > 0) {
    const { error: touchError } = await client
      .from("scraped_giveaways")
      .update({ last_seen_at: nowIso })
      .in("id", toTouch);
    if (touchError) {
      return Response.json({ error: `touch failed: ${touchError.message}` }, { status: 500 });
    }
  }

  return Response.json({
    sources: Object.values(PROMO_SOURCES).reduce((n, list) => n + list.length, 0),
    candidates: candidates.length,
    existingSkipped,
    newDrafts: toInsert.length,
    stillQueued: toTouch.length,
    sourceErrors: errors.length,
  });
}
