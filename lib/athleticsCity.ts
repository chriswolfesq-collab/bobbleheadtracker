// The Athletics played their last season at the Oakland Coliseum in 2024 and
// moved to Sutter Health Park in West Sacramento for 2025, so every A's
// bobblehead belongs to one era or the other. The listing's year picks the
// default, which keeps the whole back catalog correct without anyone touching
// it; an admin or the team's rep can override that per listing from the edit
// dialog when the year alone gets it wrong.
//
// Nothing else in the catalog has this split, so the choice only appears on the
// Athletics — see hasCityChoice.

export const ATHLETICS_SLUG = "athletics";

export const ATHLETICS_CITIES = ["Oakland", "Sacramento"] as const;
export type AthleticsCity = (typeof ATHLETICS_CITIES)[number];

/** The franchise's last season in Oakland. */
const LAST_OAKLAND_SEASON = 2024;

export function hasCityChoice(teamSlug: string): boolean {
  return teamSlug === ATHLETICS_SLUG;
}

function isAthleticsCity(value: string | null | undefined): value is AthleticsCity {
  return (ATHLETICS_CITIES as readonly string[]).includes(value ?? "");
}

// "Unknown" (and anything else without a leading four-digit year) gets no city
// rather than a guess.
export function defaultCityForYear(year: string): AthleticsCity | null {
  const parsed = Number.parseInt(year, 10);
  if (!Number.isInteger(parsed)) return null;
  return parsed <= LAST_OAKLAND_SEASON ? "Oakland" : "Sacramento";
}

// `stored` is the explicit pick saved against the listing — the override row for
// a curated listing, the row itself for a community one. Null there means "no
// one has chosen", not "no city", so it falls through to the year.
export function resolveAthleticsCity(
  teamSlug: string,
  year: string,
  stored: string | null | undefined,
): AthleticsCity | null {
  if (!hasCityChoice(teamSlug)) return null;
  if (isAthleticsCity(stored)) return stored;
  return defaultCityForYear(year);
}
