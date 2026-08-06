/**
 * Rarity is set by hand, per listing, by an admin or team rep — it is not
 * derived from anything.
 *
 * It used to be computed from the "Quantity Issued" figure (under 10,000 →
 * Ultra Rare, and so on). That was wrong in both directions. Rarity is a
 * function of demand and resale-market availability as much as print run, so a
 * short run of a player nobody chases isn't rare, and a 25,000-run fan favorite
 * can be. And a genuinely scarce piece with no quantity on record could never
 * be flagged at all, because there was no number to threshold.
 *
 * So: no tier unless someone states one. Listings with no rarity set — which is
 * all of them until marked — get no badge, and the quantity issued is still
 * shown on the page as the plain fact it is.
 *
 * Stored in `bobblehead_overrides.rarity` for curated listings and
 * `community_bobbleheads.rarity` for community ones; see
 * supabase/manual_rarity.sql.
 */
export type RarityTier = "ultra-rare" | "rare" | "limited";

/** Ordered scarcest-first, which is the order the edit dialog offers them in. */
export const RARITY_TIERS: readonly RarityTier[] = ["ultra-rare", "rare", "limited"];

export const RARITY_LABELS: Record<RarityTier, string> = {
  "ultra-rare": "Ultra Rare",
  rare: "Rare",
  limited: "Limited",
};

export interface Rarity {
  tier: RarityTier;
  label: string;
  /**
   * Why this one is rare, in the admin's own words ("Fewer than 200 known to
   * exist"). Null when none was given, in which case the page states that the
   * badge was set by hand rather than inventing a reason.
   */
  note: string | null;
}

/**
 * Narrows a stored string to a tier we can render. A check constraint keeps the
 * column to these three values, but the column is plain text and the row can
 * predate — or outlive — that constraint, so an unrecognized value drops the
 * badge rather than rendering an unstyled one.
 */
export function parseRarityTier(value?: string | null): RarityTier | null {
  return RARITY_TIERS.includes(value as RarityTier) ? (value as RarityTier) : null;
}

export function getRarity(tier?: string | null, note?: string | null): Rarity | null {
  const parsed = parseRarityTier(tier);
  if (!parsed) return null;

  return { tier: parsed, label: RARITY_LABELS[parsed], note: note?.trim() || null };
}
