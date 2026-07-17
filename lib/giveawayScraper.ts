// Heuristic scraper that turns a team's promo-schedule page HTML into candidate
// giveaway entries for the admin review queue (app/admin/scraped-giveaways).
//
// It is deliberately recall-biased: a human vets every draft before it goes
// live, so a few false positives are cheap while a missed giveaway is not. The
// extraction works on the page's visible *text*, not a fixed set of CSS
// selectors, so it survives the wildly different markup across team promo pages
// as long as each promo renders roughly one line of "<date> … <player>
// Bobblehead …" text. Nothing here touches the network except fetchPromoPage,
// which is injectable so the extractor can be unit-tested against fixtures.

import type { PromoSource } from "@/lib/promoSources";

export type ScrapeCandidate = {
  teamSlug: string;
  title: string;
  year: string;
  date: string; // "June 28, 2025"
  sourceUrl: string;
  detectedText: string; // the raw line we matched, for admin context
  dedupeKey: string; // slugify(title)-year, stable across runs
};

export type ScrapeError = { teamSlug: string; url: string; error: string };

export type ScrapeResult = {
  candidates: ScrapeCandidate[];
  errors: ScrapeError[];
};

// A real browser UA — some team sites serve a 403 to obviously-scripted
// clients. Same rationale as lib/deadImageSweep.ts.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 BobbleshelfGiveawayScraper/1.0";

// Per-request timeout and how many pages we fetch at once. With ~30 sources and
// an 8s ceiling, a pool of 8 finishes comfortably inside the route's 60s budget.
const REQUEST_TIMEOUT_MS = 8000;
const CONCURRENCY = 8;

const MONTH_INDEX: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// A month-name date, e.g. "June 28", "Jun. 28th, 2025", "September 1 2024".
const MONTH_DATE_RE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i;
// A numeric date, e.g. "6/28", "06/28/2025", "6/28/25".
const NUMERIC_DATE_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
// Weekday words we strip out of a candidate title.
const WEEKDAY_RE = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?\b/gi;

// Match the id/slug scheme used everywhere else (see approve_submission in
// supabase/schema.sql: lower, non-alphanumeric runs collapse to a hyphen).
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Normalize a title for duplicate comparison — same idea as
// lib/duplicateCheck.ts's private normalizer, exported here so the scrape route
// can diff candidates against existing curated/community listings.
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Flatten HTML to visible text, one logical line per block-level element, so
// each promo entry lands on its own line for the line-oriented extractor below.
function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|td|th|h[1-6]|section|article|ul|ol|table|header|footer)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&(?:#0?39|#x27|rsquo|lsquo|apos);/gi, "'")
    .replace(/&(?:quot|#34|ldquo|rdquo);/gi, '"')
    .replace(/&(?:#8211|#8212|ndash|mdash);/gi, "-")
    .replace(/&[a-z0-9#]+;/gi, " ");

  return text
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .filter(Boolean);
}

// Find the first date in a string and return it as a normalized display string
// plus its year. A month-name date without a year (common on in-season promo
// pages) borrows defaultYear. Returns null when there's no date.
export function parsePromoDate(
  text: string,
  defaultYear: string,
): { display: string; year: string } | null {
  const m = text.match(MONTH_DATE_RE);
  if (m) {
    const month = MONTH_INDEX[m[1].slice(0, 3).toLowerCase()];
    const day = Number(m[2]);
    const year = m[3] ?? defaultYear;
    if (month && day >= 1 && day <= 31) {
      return { display: `${MONTH_NAMES[month - 1]} ${day}, ${year}`, year: String(year) };
    }
  }

  const n = text.match(NUMERIC_DATE_RE);
  if (n) {
    const month = Number(n[1]);
    const day = Number(n[2]);
    let year = defaultYear;
    if (n[3]) year = n[3].length === 2 ? `20${n[3]}` : n[3];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { display: `${MONTH_NAMES[month - 1]} ${day}, ${year}`, year };
    }
  }

  return null;
}

function stripDatesAndWeekdays(text: string): string {
  return text
    .replace(new RegExp(MONTH_DATE_RE, "gi"), " ")
    .replace(new RegExp(NUMERIC_DATE_RE, "g"), " ")
    .replace(WEEKDAY_RE, " ");
}

function tidy(text: string): string {
  return text
    .replace(/[-–—:•|]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N})]+$/u, "")
    .trim();
}

// Derive a listing title from a promo line already known to mention a
// bobblehead. The player/name almost always sits immediately before the word
// "bobblehead" ("… Tarik Skubal Bobblehead, presented by …"); when it doesn't,
// fall back to the marketing-stripped text after it.
function deriveTitle(line: string): string {
  const idx = line.toLowerCase().indexOf("bobblehead");
  const before = idx >= 0 ? line.slice(0, idx) : line;

  let title = tidy(stripDatesAndWeekdays(before));

  if (title.length < 2 && idx >= 0) {
    const after = line
      .slice(idx + "bobblehead".length)
      .replace(/\b(presented|sponsored)\s+by\b[\s\S]*$/i, " ")
      .replace(/\b(giveaway|giveaways|night|day|series|promotion|promo)\b/gi, " ")
      .replace(/\(([^)]*\b(fans|guests|kids|ages?)\b[^)]*)\)/gi, " ");
    title = tidy(stripDatesAndWeekdays(after));
  }

  return title;
}

function isPlausibleTitle(title: string): boolean {
  if (title.length < 2 || title.length > 90) return false;
  if (!/\p{L}/u.test(title)) return false;
  // Reject titles that are nothing but a generic promo word.
  return !/^(the|a|an|fan|fans|kids?|giveaway|promo(?:tion)?|mystery)$/i.test(title.trim());
}

// Pull candidate giveaways out of one page's HTML. A line qualifies when it
// mentions a bobblehead and either it — or the line just above/below it — names
// a date. Candidates are deduped within the page by dedupeKey.
export function extractCandidates(
  html: string,
  teamSlug: string,
  sourceUrl: string,
  defaultYear: string,
): ScrapeCandidate[] {
  const lines = htmlToLines(html);
  const seen = new Set<string>();
  const candidates: ScrapeCandidate[] = [];

  lines.forEach((line, i) => {
    if (!/bobblehead/i.test(line)) return;

    const parsed =
      parsePromoDate(line, defaultYear) ??
      (i > 0 ? parsePromoDate(lines[i - 1], defaultYear) : null) ??
      (i + 1 < lines.length ? parsePromoDate(lines[i + 1], defaultYear) : null);
    if (!parsed) return;

    const title = deriveTitle(line);
    if (!isPlausibleTitle(title)) return;

    const dedupeKey = `${slugify(title)}-${parsed.year}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    candidates.push({
      teamSlug,
      title,
      year: parsed.year,
      date: parsed.display,
      sourceUrl,
      detectedText: line.slice(0, 200),
      dedupeKey,
    });
  });

  return candidates;
}

export type FetchImpl = typeof fetch;

// Fetch a promo page's HTML. Kept separate and injectable so extractCandidates
// can be tested without hitting the network.
export async function fetchPromoPage(url: string, fetchImpl: FetchImpl = fetch): Promise<string> {
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
  });
  if (!response.ok) {
    throw new Error(`http_${response.status}`);
  }
  return response.text();
}

// Run `fn` over `items` with at most `limit` in flight at once. Mirrors the
// pool in lib/deadImageSweep.ts.
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

// Fetch and extract every configured promo source concurrently. A source that
// errors (timeout, non-2xx, unreachable) is recorded and skipped; one bad team
// page never sinks the run.
export async function scrapeAll(
  sources: Record<string, PromoSource[]>,
  opts: { defaultYear: string; fetchImpl?: FetchImpl; concurrency?: number },
): Promise<ScrapeResult> {
  const jobs: { teamSlug: string; url: string }[] = [];
  for (const [teamSlug, list] of Object.entries(sources)) {
    for (const source of list) jobs.push({ teamSlug, url: source.url });
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const errors: ScrapeError[] = [];

  const perJob = await pool(jobs, opts.concurrency ?? CONCURRENCY, async (job) => {
    try {
      const html = await fetchPromoPage(job.url, fetchImpl);
      return extractCandidates(html, job.teamSlug, job.url, opts.defaultYear);
    } catch (err) {
      errors.push({
        teamSlug: job.teamSlug,
        url: job.url,
        error: err instanceof Error ? err.message : "unknown",
      });
      return [] as ScrapeCandidate[];
    }
  });

  // Dedupe across a team's sources by dedupeKey (a promo can appear on more
  // than one of a team's pages).
  const byKey = new Map<string, ScrapeCandidate>();
  for (const candidate of perJob.flat()) {
    byKey.set(`${candidate.teamSlug}/${candidate.dedupeKey}`, candidate);
  }

  return { candidates: [...byKey.values()], errors };
}
