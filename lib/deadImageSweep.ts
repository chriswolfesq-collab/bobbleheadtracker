import type { SupabaseClient } from "@supabase/supabase-js";
import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";

// A single image URL the site can display, tagged with where it came from and
// which listing it belongs to (so the admin queue can link back). One listing
// can produce several targets; distinct listings can share a URL — the sweep
// dedupes the network check by URL but records a dead row per target.
export type ImageTarget = {
  source: "curated" | "approved_photo" | "community" | "gallery";
  listingKind: "curated" | "community";
  teamSlug: string;
  bobbleheadId: string;
  title: string | null;
  imageUrl: string;
};

export type DeadImage = ImageTarget & {
  httpStatus: number | null;
  error: string | null;
};

type UrlVerdict = { ok: boolean; status: number | null; error: string | null };

// Per-request timeout and how many URLs we fetch at once. The whole crawl is a
// few hundred URLs, so a pool of 10 finishes well inside the route's 60s budget.
const REQUEST_TIMEOUT_MS = 8000;
const CONCURRENCY = 10;

// A real browser UA — some image CDNs serve a 403 to obviously-scripted clients.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 BobbleshelfImageSweep/1.0";

// The curated giveaway ids, keyed by team, so a photo/gallery row whose
// bobblehead_id isn't a known curated listing is treated as community.
function buildCuratedIndex(): {
  keys: Set<string>;
  titleFor: (teamSlug: string, id: string) => string | null;
} {
  const keys = new Set<string>();
  const titles = new Map<string, string>();
  for (const [teamSlug, giveaways] of Object.entries(GIVEAWAYS_BY_TEAM)) {
    for (const giveaway of giveaways) {
      const key = `${teamSlug}/${giveaway.id}`;
      keys.add(key);
      titles.set(key, giveaway.title);
    }
  }
  return {
    keys,
    titleFor: (teamSlug, id) => titles.get(`${teamSlug}/${id}`) ?? null,
  };
}

// Gather every image URL from all four sources: the curated seed URLs in the
// bundled JSON plus the admin/community/gallery photos in the database.
export async function collectTargets(client: SupabaseClient): Promise<ImageTarget[]> {
  const curated = buildCuratedIndex();
  const targets: ImageTarget[] = [];

  // 1. Curated seed images (data/giveaways/*.json via GIVEAWAYS_BY_TEAM).
  for (const [teamSlug, giveaways] of Object.entries(GIVEAWAYS_BY_TEAM)) {
    for (const giveaway of giveaways) {
      if (!giveaway.imageUrl) continue;
      targets.push({
        source: "curated",
        listingKind: "curated",
        teamSlug,
        bobbleheadId: giveaway.id,
        title: giveaway.title,
        imageUrl: giveaway.imageUrl,
      });
    }
  }

  const listingKindFor = (teamSlug: string, id: string): "curated" | "community" =>
    curated.keys.has(`${teamSlug}/${id}`) ? "curated" : "community";

  // 2. Admin-approved main photos.
  const { data: approved, error: approvedError } = await client
    .from("approved_photos")
    .select("team_slug, bobblehead_id, image_url");
  if (approvedError) throw new Error(`approved_photos read failed: ${approvedError.message}`);
  for (const row of approved ?? []) {
    if (!row.image_url) continue;
    const listingKind = listingKindFor(row.team_slug, row.bobblehead_id);
    targets.push({
      source: "approved_photo",
      listingKind,
      teamSlug: row.team_slug,
      bobbleheadId: row.bobblehead_id,
      title: listingKind === "curated" ? curated.titleFor(row.team_slug, row.bobblehead_id) : null,
      imageUrl: row.image_url,
    });
  }

  // 3. Community bobbleheads (image_url is nullable).
  const { data: community, error: communityError } = await client
    .from("community_bobbleheads")
    .select("id, team_slug, title, image_url")
    .not("image_url", "is", null);
  if (communityError) throw new Error(`community_bobbleheads read failed: ${communityError.message}`);
  for (const row of community ?? []) {
    if (!row.image_url) continue;
    targets.push({
      source: "community",
      listingKind: "community",
      teamSlug: row.team_slug,
      bobbleheadId: row.id,
      title: row.title ?? null,
      imageUrl: row.image_url,
    });
  }

  // 4. Gallery photos (can hang off either a curated or a community listing).
  const { data: gallery, error: galleryError } = await client
    .from("bobblehead_gallery_photos")
    .select("bobblehead_id, team_slug, image_url");
  if (galleryError) throw new Error(`bobblehead_gallery_photos read failed: ${galleryError.message}`);
  for (const row of gallery ?? []) {
    if (!row.image_url) continue;
    const listingKind = listingKindFor(row.team_slug, row.bobblehead_id);
    targets.push({
      source: "gallery",
      listingKind,
      teamSlug: row.team_slug,
      bobbleheadId: row.bobblehead_id,
      title: listingKind === "curated" ? curated.titleFor(row.team_slug, row.bobblehead_id) : null,
      imageUrl: row.image_url,
    });
  }

  return targets;
}

// Fetch a single URL and decide whether the image is reachable. A GET with a
// tiny Range keeps the transfer to a few bytes; HEAD is avoided because several
// image CDNs (e.g. i.ebayimg.com) reject it while serving GET fine. Any status
// >= 400, or a network/timeout failure, counts as dead.
export async function checkUrl(url: string): Promise<UrlVerdict> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "image/*,*/*",
        Range: "bytes=0-0",
      },
    });
    // Drain/close the body so the connection can be reused/released.
    await response.body?.cancel().catch(() => {});
    if (response.status >= 400) {
      return { ok: false, status: response.status, error: `http_${response.status}` };
    }
    return { ok: true, status: response.status, error: null };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return { ok: false, status: null, error: isTimeout ? "timeout" : "network" };
  }
}

// Run `fn` over `items` with at most `limit` in flight at once.
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export type SweepResult = {
  targetCount: number;
  urlCount: number;
  dead: DeadImage[];
};

// Collect every image target, check each distinct URL once, and return the
// targets whose URL came back dead.
export async function runSweep(client: SupabaseClient): Promise<SweepResult> {
  const targets = await collectTargets(client);
  const uniqueUrls = [...new Set(targets.map((t) => t.imageUrl))];

  const verdicts = await pool(uniqueUrls, CONCURRENCY, checkUrl);
  const verdictByUrl = new Map<string, UrlVerdict>();
  uniqueUrls.forEach((url, i) => verdictByUrl.set(url, verdicts[i]));

  const dead: DeadImage[] = [];
  for (const target of targets) {
    const verdict = verdictByUrl.get(target.imageUrl);
    if (verdict && !verdict.ok) {
      dead.push({ ...target, httpStatus: verdict.status, error: verdict.error });
    }
  }

  return { targetCount: targets.length, urlCount: uniqueUrls.length, dead };
}
