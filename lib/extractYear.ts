export const UNKNOWN_YEAR = "Unknown";

// Pulls the season year out of a human-readable release date ("September 22,
// 2025" -> "2025"). The catalog stores dates as free text, so a date with no
// 4-digit year in it ("N/A", "Opening Day") yields the fallback — callers pass
// the previously-stored year to preserve it when only other fields change.
export function extractYear(date: string, fallback: string = UNKNOWN_YEAR): string {
  const match = date.match(/\b\d{4}\b/);
  return match ? match[0] : fallback;
}
