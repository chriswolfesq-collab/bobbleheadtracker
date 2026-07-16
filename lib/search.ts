import { GIVEAWAYS_BY_TEAM } from "./bobbleheads";
import { TEAMS } from "./teams";

export type SearchResult = {
  id: string;
  title: string;
  date: string;
  year: string;
  imageUrl?: string | null;
  teamSlug: string;
  teamName: string;
  teamCity: string;
  href: string;
  source: "curated" | "community";
};

function buildCuratedIndex(): SearchResult[] {
  const results: SearchResult[] = [];

  for (const team of TEAMS) {
    const giveaways = GIVEAWAYS_BY_TEAM[team.slug] ?? [];
    for (const giveaway of giveaways) {
      results.push({
        id: giveaway.id,
        title: giveaway.title,
        date: giveaway.date,
        year: giveaway.year,
        imageUrl: giveaway.imageUrl,
        teamSlug: team.slug,
        teamName: team.name,
        teamCity: team.city,
        href: `/teams/${team.slug}/bobbleheads/${giveaway.id}`,
        source: "curated",
      });
    }
  }

  return results;
}

export const CURATED_SEARCH_INDEX: SearchResult[] = buildCuratedIndex();

export function searchGiveaways(
  results: SearchResult[],
  query: string,
  limit = 20,
): SearchResult[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const matches: SearchResult[] = [];
  for (const result of results) {
    const haystack = `${result.title} ${result.date} ${result.year} ${result.teamName} ${result.teamCity} ${result.teamSlug}`.toLowerCase();
    if (terms.every((term) => haystack.includes(term))) {
      matches.push(result);
      if (matches.length >= limit) break;
    }
  }

  return matches;
}
