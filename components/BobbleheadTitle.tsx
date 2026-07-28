/**
 * Splits a bobblehead title into a primary line and an optional secondary line.
 *
 * The secondary line is the trailing parenthetical portion of the title, with the
 * wrapping parentheses removed — e.g. `Luis Arraez ("La Regadera")` becomes
 * `{ primary: "Luis Arraez", secondary: "“La Regadera”" }`. Titles without a
 * trailing parenthetical (or that are entirely parenthetical) keep a null secondary.
 */
export function splitTitle(title: string): { primary: string; secondary: string | null } {
  const trimmed = title.trim();
  if (!trimmed.endsWith(")")) return { primary: trimmed, secondary: null };

  // Walk back from the final ")" to find its matching "(".
  let depth = 0;
  let openIndex = -1;
  for (let i = trimmed.length - 1; i >= 0; i--) {
    const ch = trimmed[i];
    if (ch === ")") depth++;
    else if (ch === "(") {
      depth--;
      if (depth === 0) {
        openIndex = i;
        break;
      }
    }
  }

  if (openIndex <= 0) return { primary: trimmed, secondary: null };

  const primary = trimmed.slice(0, openIndex).trim();
  const secondary = trimmed.slice(openIndex + 1, -1).trim();
  if (!primary || !secondary) return { primary: trimmed, secondary: null };

  return { primary, secondary };
}

/**
 * Renders a bobblehead title with its nickname dropped onto a second line beneath
 * the primary name. An explicit `nickname` wins: the title is shown as-is on line
 * one and the nickname on line two. With no explicit nickname, the title's own
 * trailing parenthetical is auto-split onto the second line instead. The secondary
 * line scales relative to the parent font size, so it works for both small cards
 * and large detail headings.
 */
// Some listings carry a punctuation-only nickname ("_", "-") — a hand-added
// spacer from when a missing second line made neighboring cards sit at
// different heights. The cards align on their own now, so treat these as no
// nickname rather than rendering a stray character.
function isSpacerNickname(value: string): boolean {
  return /^[_\-–—.·•\s]+$/.test(value);
}

/**
 * Resolves the primary/secondary display lines for a bobblehead without
 * rendering them — for callers that need to style the two lines differently
 * (e.g. the card's single-line auto-shrinking name).
 */
export function resolveTitleParts(
  title: string,
  nickname?: string | null,
): { primary: string; secondary: string | null } {
  const trimmedNickname = nickname?.trim();
  const explicitNickname = trimmedNickname && !isSpacerNickname(trimmedNickname) ? trimmedNickname : undefined;
  return explicitNickname
    ? { primary: title.trim(), secondary: explicitNickname }
    : splitTitle(title);
}

export function BobbleheadTitle({ title, nickname }: { title: string; nickname?: string | null }) {
  const trimmedNickname = nickname?.trim();
  const explicitNickname = trimmedNickname && !isSpacerNickname(trimmedNickname) ? trimmedNickname : undefined;
  const { primary, secondary } = explicitNickname
    ? { primary: title.trim(), secondary: explicitNickname }
    : splitTitle(title);

  if (!secondary) return <>{primary}</>;

  return (
    <>
      {primary}
      <span className="mt-0.5 block text-[0.82em] font-semibold opacity-80">{secondary}</span>
    </>
  );
}
