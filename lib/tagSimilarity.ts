// Which tags might be saying the same thing twice.
//
// The vocabulary is shared, but nothing stops two people reaching for two names
// for one idea — "All Star Game" beside "All-Star", "Sugar Skulls" beside
// "Sugar Skull", "Star Wras" beside "Star Wars". A slug keeps the *same* name
// from being minted twice; it does nothing about a near miss, and a near miss
// splits a tag's listings across two pages where neither is complete.
//
// This is the shape-matching half only: the picker uses it to ask before it
// mints, and the admin queue uses it to list what already got through. No
// queries here — the vocabulary is passed in.

import { slugifyTag, type Tag } from "@/lib/tags";

/**
 * Why two tags look alike, worst offence first. `same-words` is near-certainly
 * one idea twice; `overlap` is the loosest and often legitimate (a tag really
 * can be a narrower version of another), which is why the admin queue can
 * dismiss a pair rather than being asked about it forever.
 */
export type SimilarityReason = "same-words" | "typo" | "overlap";

const REASON_RANK: Record<SimilarityReason, number> = {
  "same-words": 0,
  typo: 1,
  overlap: 2,
};

export type SimilarTag<T extends Tag = Tag> = { tag: T; reason: SimilarityReason };

const tokens = (slug: string): string[] => slug.split("-").filter(Boolean);

// Deliberately crude — "buddies" -> "buddie" is wrong and doesn't matter, since
// both sides of a comparison get the same treatment and the result is only ever
// used to ask a human. Anything cleverer would need a word list.
function singular(word: string): string {
  if (word.length > 4 && /(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Sorted, singularised words: catches plurals and a different word order. */
function wordKey(slug: string): string {
  return tokens(slug).map(singular).sort().join("-");
}

/** The same words run together: catches a hyphen or space that moved. */
function letterKey(slug: string): string {
  return tokens(slug).map(singular).join("");
}

/** The slug with its hyphens closed up, untouched otherwise — the typo check
 *  wants the letters as typed, since singularising first would read the missing
 *  letter in "Star Wras" as a plural and edit it away. */
function compact(slug: string): string {
  return slug.replace(/-/g, "");
}

// Edit distance counting a swap of two neighbours as one mistake rather than
// two, because that's what a typo usually is — "wras" for "wars" is one slip of
// the fingers, and plain Levenshtein scores it the same as two unrelated edits.
function editDistance(a: string, b: string): number {
  if (a === b) return 0;

  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, index) => index)];

  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      row[j] = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, substitution);

      // The transposition case: the last two characters of each are the same
      // pair, the other way round.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j], rows[i - 2][j - 2] + 1);
      }
    }
    rows.push(row);
  }

  return rows[a.length][b.length];
}

const digitsOf = (value: string): string => (value.match(/\d/g) ?? []).join("");

// One typo in a short word is a different word ("dogs"/"docs"), so below five
// letters nothing counts as a typo at all; a second edit only becomes plausible
// once the name is long enough to fat-finger twice.
//
// Numbers are exempt whatever the distance: consecutive seasons are one
// character apart and "World Series 2018" is not a misspelling of "World Series
// 2019".
function isTypo(a: string, b: string): boolean {
  if (digitsOf(a) !== digitsOf(b)) return false;

  const longest = Math.max(a.length, b.length);
  if (longest < 5) return false;
  return editDistance(a, b) <= (longest >= 9 ? 2 : 1);
}

// A prefix or suffix run of whole words, not any old shared word: "All-Star"
// inside "All-Star Game" is worth a question, while two tags that merely both
// contain "night" somewhere are not.
function isOverlap(a: string, b: string): boolean {
  const [shorter, longer] = a.length <= b.length ? [tokens(a), tokens(b)] : [tokens(b), tokens(a)];
  if (shorter.length === 0 || shorter.length >= longer.length) return false;
  if (shorter.join("").length < 4) return false;

  const head = longer.slice(0, shorter.length).join("-");
  const tail = longer.slice(longer.length - shorter.length).join("-");
  const needle = shorter.join("-");

  return needle === head || needle === tail;
}

/** How alike two slugs are, or null if they aren't. Exact matches are nobody's
 *  duplicate — that's one tag, and the picker just applies it. */
export function compareTagSlugs(a: string, b: string): SimilarityReason | null {
  if (!a || !b || a === b) return null;

  if (wordKey(a) === wordKey(b) || letterKey(a) === letterKey(b)) return "same-words";
  // A typo doesn't add or remove a whole word. Without this, "NL Batting
  // Champion" reads as a two-character slip of "Batting Champion" rather than
  // what it is: one name sitting inside a longer one.
  if (tokens(a).length === tokens(b).length && isTypo(compact(a), compact(b))) return "typo";
  if (isOverlap(a, b)) return "overlap";

  return null;
}

/**
 * Tags that might already cover `label`, closest first. Fed the raw text
 * someone typed, so it slugs it the same way minting would — what's compared is
 * what would actually be created.
 */
export function findSimilarTags<T extends Tag>(label: string, vocabulary: T[]): SimilarTag<T>[] {
  const slug = slugifyTag(label);
  if (!slug) return [];

  const found: SimilarTag<T>[] = [];
  for (const tag of vocabulary) {
    const reason = compareTagSlugs(slug, tag.slug);
    if (reason) found.push({ tag, reason });
  }

  return found.sort(
    (a, b) => REASON_RANK[a.reason] - REASON_RANK[b.reason] || a.tag.label.localeCompare(b.tag.label),
  );
}

export type DuplicatePair<T extends Tag = Tag> = {
  /** Ordered by slug, so a pair has one identity however it was found. */
  a: T;
  b: T;
  reason: SimilarityReason;
  key: string;
};

/** The identity of a pair, order-independent — what a dismissal is stored under. */
export function duplicatePairKey(slugA: string, slugB: string): string {
  return slugA < slugB ? `${slugA}|${slugB}` : `${slugB}|${slugA}`;
}

/** Every pair in the vocabulary that looks like one idea twice, worst first. */
export function findDuplicatePairs<T extends Tag>(vocabulary: T[]): DuplicatePair<T>[] {
  const pairs: DuplicatePair<T>[] = [];

  for (let i = 0; i < vocabulary.length; i += 1) {
    for (let j = i + 1; j < vocabulary.length; j += 1) {
      const first = vocabulary[i];
      const second = vocabulary[j];
      const reason = compareTagSlugs(first.slug, second.slug);
      if (!reason) continue;

      const [a, b] = first.slug < second.slug ? [first, second] : [second, first];
      pairs.push({ a, b, reason, key: duplicatePairKey(a.slug, b.slug) });
    }
  }

  return pairs.sort(
    (x, y) => REASON_RANK[x.reason] - REASON_RANK[y.reason] || x.a.label.localeCompare(y.a.label),
  );
}

/** One line for the UI, in the same voice for the picker and the admin queue. */
export function describeSimilarity(reason: SimilarityReason): string {
  switch (reason) {
    case "same-words":
      return "the same words";
    case "typo":
      return "a letter or two apart";
    case "overlap":
      return "one name inside the other";
  }
}
