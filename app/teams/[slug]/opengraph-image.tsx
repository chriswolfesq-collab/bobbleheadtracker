import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import { getTeamBySlug } from "@/lib/teams";

export const alt = "An MLB team's stadium giveaway bobbleheads on Bobble Shelf";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Both the giveaway list and the team's representative figure are static build
// data, so this card is fully known at build time — one image per team is baked
// once. No force-dynamic: unlike the shelf card (a live per-account count) there
// is nothing request-time to read here.

// Lifts a team's primary color to something legible on the dark base. Roughly a
// third of the primaries (Yankees, Rays, Astros, Padres, White Sox…) are near-
// black navies/browns that vanish against the gradient, so any color below a
// brightness floor is blended toward white until it clears it. Colors that are
// already bright (Marlins cyan, Pirates gold) pass through untouched.
function legibleAccent(hex: string): string {
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

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = getTeamBySlug(slug);

  // Matches the page's notFound for an unknown slug: no image rather than a
  // broken card.
  if (!team) return new Response("Not found", { status: 404 });

  const giveaways = getGiveawaysByTeamSlug(slug);
  const count = giveaways.length;

  // The span the shelf covers, shown as a quiet subtitle. Years are free-text
  // strings; keep only the four-digit ones so a stray value can't blow out the
  // range.
  const years = giveaways
    .map((g) => Number.parseInt(g.year, 10))
    .filter((y) => Number.isFinite(y) && y > 1900);
  const minYear = years.length ? Math.min(...years) : null;
  const maxYear = years.length ? Math.max(...years) : null;
  const yearRange =
    minYear && maxYear ? (minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`) : null;

  // The team's representative figure, the same pre-baked 200x480 og/ thumbnail
  // the shelf card uses. Not every team is guaranteed to have one on disk, so a
  // missing file just drops the figure rather than failing the render.
  let figure: string | null = null;
  try {
    const data = await readFile(join(process.cwd(), `public/bobbleheads/og/${slug}.png`));
    figure = `data:image/png;base64,${data.toString("base64")}`;
  } catch {
    figure = null;
  }

  // Satori ships no system fonts and won't synthesize weights, so the heavy type
  // this design needs has to be handed in explicitly.
  const [black, regular] = await Promise.all([
    readFile(join(process.cwd(), "assets/Geist-Black.ttf")),
    readFile(join(process.cwd(), "assets/Geist-Regular.ttf")),
  ]);

  // The team's primary color drives the accents (eyebrow, count, ledge) over a
  // dark base. Using the color as an accent rather than the background keeps
  // white text legible for all 30 teams — several primaries (Pirates gold,
  // Marlins cyan) would fail contrast if the whole card were flooded with them.
  const accent = legibleAccent(team.primary);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          // Linear rather than the site's radial gradient: Satori's radial
          // support is patchy and the difference is invisible at this size.
          backgroundImage: "linear-gradient(160deg, #1b2a4a 0%, #0e1626 45%, #090e1a 100%)",
          fontFamily: "Geist",
          padding: "48px 60px 40px",
        }}
      >
        {/* Header: which team, and the number of figures the shelf holds. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "0.35em",
              color: accent,
            }}
          >
            MLB STADIUM GIVEAWAYS
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 10,
              fontSize: 60,
              fontWeight: 900,
              color: "white",
              textAlign: "center",
            }}
          >
            {team.city} {team.name}
          </div>

          {/* The reason the card exists: how much history is on this shelf. */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 6 }}>
            <div style={{ display: "flex", fontSize: 132, fontWeight: 900, lineHeight: 1, color: "#fbbf24" }}>
              {count}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 40,
                fontWeight: 900,
                letterSpacing: "0.18em",
                color: "#e4e4e7",
              }}
            >
              {count === 1 ? "BOBBLEHEAD" : "BOBBLEHEADS"}
            </div>
          </div>

          {yearRange ? (
            <div style={{ display: "flex", marginTop: 12, fontSize: 24, fontWeight: 400, color: "#a1a1aa" }}>
              Stadium giveaway history · {yearRange}
            </div>
          ) : null}
        </div>

        {/* The team's figure standing on a color-matched ledge. */}
        {figure ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img
              src={figure}
              alt=""
              width={75}
              height={180}
              style={{ objectFit: "contain", objectPosition: "bottom" }}
            />
            <div
              style={{
                display: "flex",
                width: 220,
                height: 12,
                borderRadius: 6,
                backgroundImage: "linear-gradient(180deg, #b45309 0%, #7c3d09 100%)",
              }}
            />
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: "0.2em",
            color: "#71717a",
          }}
        >
          BOBBLESHELF.COM
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: black, weight: 900, style: "normal" },
        { name: "Geist", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
}
