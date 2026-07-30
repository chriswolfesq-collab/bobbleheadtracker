import { GIVEAWAYS_BY_TEAM } from "./bobbleheads";
import { TEAMS } from "./teams";

export type SearchResult = {
  id: string;
  title: string;
  nickname: string | null;
  date: string;
  year: string;
  imageUrl?: string | null;
  teamSlug: string;
  teamName: string;
  teamCity: string;
  href: string;
  source: "curated" | "community";
  /**
   * Tag labels on this listing. Absent on the build-time index — tags live in
   * the database — and filled in by useSearchIndex, which is why every read
   * treats it as optional rather than assuming an array.
   */
  tags?: string[];
};

function buildCuratedIndex(): SearchResult[] {
  const results: SearchResult[] = [];

  for (const team of TEAMS) {
    const giveaways = GIVEAWAYS_BY_TEAM[team.slug] ?? [];
    for (const giveaway of giveaways) {
      results.push({
        id: giveaway.id,
        title: giveaway.title,
        nickname: giveaway.nickname ?? null,
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

// Lowercase + strip diacritics, so "pena" finds "Peña" and vice versa.
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function searchGiveaways(
  results: SearchResult[],
  query: string,
  limit = 20,
): SearchResult[] {
  const terms = fold(query.trim()).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  // Rank by where the terms match rather than returning index order (which is
  // team-then-date, so e.g. "2025" would only ever surface the first team):
  // name matches beat descriptor matches beat team/date matches, and
  // starts-with beats contains.
  //
  // Tags sit just under the name. "Star Wars" is not in any of these
  // bobbleheads' titles — that's the whole reason tags exist — so a tag match
  // has to outrank the team and date text it would otherwise lose to, or
  // searching a theme returns whichever listing happens to mention the word.
  const scored: { result: SearchResult; score: number }[] = [];
  for (const result of results) {
    const title = fold(result.title);
    const nickname = fold(result.nickname ?? "");
    const tagText = fold((result.tags ?? []).join(" "));
    const teamText = fold(`${result.teamName} ${result.teamCity} ${result.teamSlug}`);
    const dateText = fold(`${result.date} ${result.year}`);

    let score = 0;
    let matchesAll = true;
    for (const term of terms) {
      if (title.startsWith(term)) score += 8;
      else if (title.includes(term)) score += 6;
      else if (tagText.includes(term)) score += 5;
      else if (nickname.includes(term)) score += 4;
      else if (teamText.includes(term)) score += 2;
      else if (dateText.includes(term)) score += 1;
      else {
        matchesAll = false;
        break;
      }
    }
    if (matchesAll) scored.push({ result, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.result);
}
