import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPublicShelf } from "@/lib/publicShelf";

export const alt = "An MLB bobblehead collection on Bobble Shelf";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated images are statically optimized by default — Next would bake one at
// build time and serve it forever. This one reads a live count per slug, and
// the count is the entire point of the card.
export const dynamic = "force-dynamic";

// Fits on one line at 52px Geist Black inside the card's 1080px content width.
const MAX_NAME_CHARS = 26;

// This card deliberately doesn't reuse DisplayCase. Satori (what renders this)
// supports flexbox and a subset of CSS only: no container queries, no next/image,
// no grid, no percentage transforms — and DisplayCase leans on all of them. It's
// also the wrong design for the job. This is seen as a ~500px thumbnail in a
// feed, where 30 tiny bobbleheads read as mush and one enormous number doesn't.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shelf = await getPublicShelf(slug);

  // Matches the page's 404 for an unknown or private slug: no image rather than
  // a card that reveals the account exists.
  if (!shelf) return new Response("Not found", { status: 404 });

  const { displayName, stats } = shelf;

  // Display names are unbounded free text — there's no length limit in the
  // sign-up form, in updateDisplayName, or in the schema. The page can wrap a
  // long one harmlessly, but this canvas is a fixed 1200x630: a long name wraps
  // to two lines, squeezes the count, and ends up outweighing the one thing the
  // card exists to show. Clamped rather than shrunk so the name always renders
  // at the same size.
  const name =
    displayName.length > MAX_NAME_CHARS
      ? `${displayName.slice(0, MAX_NAME_CHARS - 1).trimEnd()}…`
      : displayName;

  // Satori has no system fonts, and it doesn't synthesize weights — a font it
  // wasn't given renders at whatever it has, so the heavy type this design
  // depends on has to be supplied explicitly.
  const [black, regular] = await Promise.all([
    readFile(join(process.cwd(), "assets/Geist-Black.ttf")),
    readFile(join(process.cwd(), "assets/Geist-Regular.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          // Linear rather than the site's radial gradient: radial support in
          // Satori is patchy, and at this size the difference isn't visible.
          backgroundImage: "linear-gradient(160deg, #1b2a4a 0%, #0e1626 45%, #090e1a 100%)",
          fontFamily: "Geist",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: "0.35em",
            color: "#f59e0b",
          }}
        >
          MLB BOBBLEHEAD SHELF
        </div>

        <div style={{ display: "flex", marginTop: 14, fontSize: 52, fontWeight: 900, color: "white" }}>
          {name}
        </div>

        {/* The reason the card exists. Sized to stay legible when a timeline
            scales this down to a thumbnail. */}
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 200,
            fontWeight: 900,
            lineHeight: 1,
            color: "#fbbf24",
          }}
        >
          {stats.totalOwned}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 8,
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: "0.3em",
            color: "#e4e4e7",
          }}
        >
          BOBBLEHEADS
        </div>

        {/* No progress bar here, unlike the page. Against a 3627-bobblehead
            denominator even a huge collection is a low percentage, and a mostly
            empty track is the loudest thing on the card — it reads "barely
            started", which is the opposite of what a shared card should say.
            The same numbers survive as a quiet text line; the count does the
            talking. */}
        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 26,
            fontWeight: 400,
            color: "#a1a1aa",
          }}
        >
          {stats.totalOwned} of {stats.siteTotal} · {stats.teamsStarted} of {stats.teamCount} teams
          started
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 40,
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
