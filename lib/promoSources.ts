// Where the nightly giveaway scraper (app/api/giveaway-scrape) looks for new
// bobblehead promos, one or more pages per team. These are best-effort defaults
// pointing at each club's MLB.com promotions page; edit this file to add a
// better source (a team's own /promotions page, a beat-writer's schedule post,
// etc.) or to drop one that has gone stale.
//
// Note: some promo pages render their schedule client-side, so a raw fetch may
// return little parseable text. That is fine — the scraper simply finds nothing
// for that source and the admin can swap in a server-rendered URL. The scrape
// route reports per-source errors and counts so it is obvious which sources are
// actually producing candidates.

export type PromoSource = { url: string; note?: string };

// Our team slug (lib/teams.ts) -> the club token MLB.com uses in its URLs,
// which differs for the hyphenated and abbreviated names.
const MLB_CLUB: Record<string, string> = {
  angels: "angels",
  astros: "astros",
  athletics: "athletics",
  "blue-jays": "bluejays",
  braves: "braves",
  brewers: "brewers",
  cardinals: "cardinals",
  cubs: "cubs",
  diamondbacks: "dbacks",
  dodgers: "dodgers",
  giants: "giants",
  guardians: "guardians",
  mariners: "mariners",
  marlins: "marlins",
  mets: "mets",
  nationals: "nationals",
  orioles: "orioles",
  padres: "padres",
  phillies: "phillies",
  pirates: "pirates",
  rangers: "rangers",
  rays: "rays",
  "red-sox": "redsox",
  reds: "reds",
  rockies: "rockies",
  royals: "royals",
  tigers: "tigers",
  twins: "twins",
  "white-sox": "whitesox",
  yankees: "yankees",
};

export const PROMO_SOURCES: Record<string, PromoSource[]> = Object.fromEntries(
  Object.entries(MLB_CLUB).map(([slug, club]) => [
    slug,
    [{ url: `https://www.mlb.com/${club}/tickets/promotions`, note: "MLB.com promotions" }],
  ]),
);
