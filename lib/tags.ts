// The shared vocabulary behind tag browsing and tag search. Shape and naming
// rules only — the queries live in lib/useTags.ts, the schema in
// supabase/tags.sql.
//
// A tag has two halves that are deliberately not the same string: the slug is
// the identity and the URL, the label is what people read. That split is what
// lets "star wars" become "Star Wars" without breaking a link.

export type Tag = {
  slug: string;
  label: string;
};

export type TagWithCount = Tag & { listingCount: number };

export const MAX_TAG_LABEL = 40;
export const MIN_TAG_LABEL = 2;

// Diacritics are folded rather than dropped, so "Peña" slugs to "pena" and
// searching either way finds it — the same fold lib/search.ts uses.
export function slugifyTag(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Collapses the runs of whitespace that come from pasting, without touching
// the casing someone chose — "Game of Thrones" should keep its lowercase "of".
export function normalizeTagLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

export function validateTagLabel(label: string): { label: string; slug: string } | { error: string } {
  const normalized = normalizeTagLabel(label);

  if (normalized.length < MIN_TAG_LABEL) {
    return { error: `A tag needs at least ${MIN_TAG_LABEL} characters.` };
  }
  if (normalized.length > MAX_TAG_LABEL) {
    return { error: `A tag can be at most ${MAX_TAG_LABEL} characters.` };
  }

  const slug = slugifyTag(normalized);
  // Reachable with input that is all punctuation or all diacritics — "…" or
  // "•••" normalize to a non-empty label but slug to nothing at all.
  if (slug.length < MIN_TAG_LABEL) {
    return { error: "That tag needs some letters or numbers in it." };
  }

  return { label: normalized, slug };
}

export function tagHref(slug: string): string {
  return `/tags/${encodeURIComponent(slug)}`;
}

/** One row of the join table: a listing, and a tag it carries. */
export type TagAssignment = { teamSlug: string; bobbleheadId: string; tagSlug: string };

// One listing per tag, to stand as the picture of what the tag means. A label
// only reads as obvious to whoever wrote it — "Sugar Skull" and "Turn Ahead the
// Clock" both need a photo before they mean anything — so the directory shows
// an example beside each name.
//
// The caller ranks the candidates (a listing with a photo of its own beats one
// falling back to the team silhouette); ties break on the listing key, so the
// same bobblehead illustrates the tag on every load rather than shuffling with
// whatever order the rows happen to arrive in.
export function chooseTagExamples(
  assignments: TagAssignment[],
  rank: (assignment: TagAssignment) => number,
): Record<string, TagAssignment> {
  const best: Record<string, { assignment: TagAssignment; score: number; key: string }> = {};

  for (const assignment of assignments) {
    const key = `${assignment.teamSlug}:${assignment.bobbleheadId}`;
    const score = rank(assignment);
    const current = best[assignment.tagSlug];

    if (!current || score > current.score || (score === current.score && key < current.key)) {
      best[assignment.tagSlug] = { assignment, score, key };
    }
  }

  return Object.fromEntries(
    Object.entries(best).map(([tagSlug, entry]) => [tagSlug, entry.assignment]),
  );
}

// Owning a handful of a 200-listing tag rounds to 0% and reads as untouched, so
// anything owned shows at least 1% — the same floor the team shelves use.
export function tagCompletionPercent(ownedCount: number, total: number): number {
  if (total <= 0 || ownedCount <= 0) return 0;
  return Math.max(1, Math.round((ownedCount / total) * 100));
}

export type TagProgress = Tag & { listingCount: number; ownedCount: number };

// Furthest along first, so the directory opens on the tags you're close to
// finishing rather than on whatever starts with A.
//
// The share owned leads, not the count: 8 of 10 is nearer done than 30 of 200,
// and a directory sorted on the raw number would just rank the big tags. The
// count breaks a tie between two equal shares — 40 of 100 outranks 4 of 10 —
// and the label breaks that, so the order is stable rather than left to sort.
export function sortTagsByProgress<T extends TagProgress>(tags: T[]): T[] {
  return [...tags].sort(
    (a, b) =>
      tagCompletionPercent(b.ownedCount, b.listingCount) -
        tagCompletionPercent(a.ownedCount, a.listingCount) ||
      b.ownedCount - a.ownedCount ||
      a.label.localeCompare(b.label),
  );
}

// Alphabetical by what's on screen, not by slug — "The Simpsons" sorts under T
// where a reader expects it, rather than wherever its slug happens to land.
export function sortTags<T extends Tag>(tags: T[]): T[] {
  return [...tags].sort((a, b) => a.label.localeCompare(b.label));
}

// Ranks the vocabulary against what's been typed so far, for the picker's
// suggestions. Prefix beats substring beats a match on the slug alone, so
// typing "star" puts "Star Wars" above "Rock Star" and both above a tag that
// only matches through its hyphenated slug.
export function matchTags<T extends Tag>(tags: T[], query: string, limit = 8): T[] {
  const term = slugifyTag(query);
  if (!term) return sortTags(tags).slice(0, limit);

  const scored: { tag: T; score: number }[] = [];
  for (const tag of tags) {
    const label = slugifyTag(tag.label);
    if (label.startsWith(term)) scored.push({ tag, score: 3 });
    else if (label.includes(term)) scored.push({ tag, score: 2 });
    else if (tag.slug.includes(term)) scored.push({ tag, score: 1 });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.tag.label.localeCompare(b.tag.label))
    .slice(0, limit)
    .map((entry) => entry.tag);
}
