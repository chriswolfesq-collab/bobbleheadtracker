import { formatQuantity } from "@/lib/formatQuantity";

/**
 * Rarity derived from the "Quantity Issued" figure, so a badge is always
 * grounded in a stated reason rather than vibes. Thresholds come from the
 * actual catalog distribution (n≈1,900; median 15,000; modes at 10k/15k/20k/
 * 25k/40k):
 *
 *   < 10,000        → Ultra Rare  (bottom decile)
 *   10,000–14,999   → Rare        (below the median run)
 *   15,000–24,999   → Limited     (the middle of the pack)
 *   ≥ 25,000        → null        (a common run — no badge; most giveaways
 *                                  print 25–40k, so a badge would be noise)
 *
 * Listings without a parseable quantity get no badge.
 */
export type RarityTier = "ultra-rare" | "rare" | "limited";

export interface Rarity {
  tier: RarityTier;
  label: string;
  /** the stated reason the badge exists, e.g. "Only 7,500 were issued" */
  reason: string;
}

/**
 * Pulls a comparable number out of the free-text quantity field. Commas are
 * ignored; a range ("10,000-15,000") uses its lower bound; a "~" prefix is
 * fine; text without digits ("Unknown") returns null.
 */
export function parseQuantity(quantity?: string | null): number | null {
  if (!quantity) return null;
  const match = quantity.replace(/,/g, "").match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function getRarity(quantity?: string | null): Rarity | null {
  const count = parseQuantity(quantity);
  if (count == null) return null;

  const reason = `Only ${formatQuantity(String(count))} were issued`;
  if (count < 10_000) return { tier: "ultra-rare", label: "Ultra Rare", reason };
  if (count < 15_000) return { tier: "rare", label: "Rare", reason };
  if (count < 25_000) return { tier: "limited", label: "Limited", reason };
  return null;
}
