/**
 * Lifts a team's primary color to something legible on the dark OG card base.
 * Roughly a third of the primaries (Yankees, Rays, Astros, Padres, White Sox…)
 * are near-black navies/browns that vanish against the gradient, so any color
 * below a brightness floor is blended toward white until it clears it. Colors
 * that are already bright (Marlins cyan, Pirates gold) pass through untouched.
 *
 * Shared by every generated card that tints itself by team, so the same team
 * reads the same shade whichever card it turns up on.
 */
export function legibleAccent(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#f59e0b"; // fall back to the site amber for anything unparseable
  const int = Number.parseInt(m[1], 16);
  let r = (int >> 16) & 255;
  let g = (int >> 8) & 255;
  let b = int & 255;
  // Perceived brightness (ITU-R BT.601). The floor is tuned so dark navies clear
  // it after a modest lift rather than washing bright colors out.
  const brightness = (c: { r: number; g: number; b: number }) =>
    0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  const FLOOR = 150;
  if (brightness({ r, g, b }) < FLOOR) {
    const mix = 0.55; // blend toward white
    r = Math.round(r + (255 - r) * mix);
    g = Math.round(g + (255 - g) * mix);
    b = Math.round(b + (255 - b) * mix);
  }
  return `rgb(${r}, ${g}, ${b})`;
}
