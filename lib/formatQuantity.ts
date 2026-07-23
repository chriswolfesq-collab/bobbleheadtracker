// Normalizes the free-text "Number given away" field so counts read
// consistently — e.g. "40000" becomes "40,000" — while leaving any surrounding
// text intact. Each run of digits is grouped with thousands separators; words
// ("Unknown"), prefixes ("~15000" -> "~15,000"), and ranges ("10000-15000" ->
// "10,000-15,000") keep their non-digit parts. Idempotent: re-running on an
// already-grouped value ("40,000") returns it unchanged, so it's safe to apply
// on every edit.
export function formatQuantity(value: string): string {
  return value.replace(/\d[\d,]*/g, (run) => {
    const digits = run.replace(/,/g, "");
    // Insert a comma before every group of three digits from the right.
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  });
}
