import { mkdir, readdir } from "node:fs/promises";
import sharp from "sharp";

// Small transparent thumbnails of every team bobblehead, used by the shelf
// row on the shared Open Graph card (app/shelf/[slug]/opengraph-image.tsx).
// The full-size figures are ~1.5MB each; embedding a handful of those as
// base64 into a per-request dynamic OG render would be far too heavy, so we
// downscale once here and commit the results. Width is generous enough to
// stay crisp at the ~180px the card draws them.
const SRC_DIR = "public/bobbleheads";
const OUT_DIR = "public/bobbleheads/og";
// Every thumb is fitted onto one fixed canvas with the figure anchored to the
// bottom-center. That gives all 30 a single aspect ratio, so the OG card can
// draw them at a uniform width and — because the transparent padding is on top
// — they line up standing on the shelf ledge at their natural relative heights.
const WIDTH = 200;
const HEIGHT = 480;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const files = (await readdir(SRC_DIR)).filter((name) => name.endsWith(".png"));

  for (const file of files) {
    await sharp(`${SRC_DIR}/${file}`)
      .resize({
        width: WIDTH,
        height: HEIGHT,
        fit: "contain",
        position: "bottom",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      // Palette-quantized: keeps the alpha cut-out but shrinks each thumb from
      // ~175KB to ~30KB, which matters because several are base64-inlined into
      // every dynamic OG render.
      .png({ palette: true, quality: 85, compressionLevel: 9 })
      .toFile(`${OUT_DIR}/${file}`);
  }

  console.log(`Generated ${files.length} OG thumbnails (${WIDTH}x${HEIGHT}) in ${OUT_DIR}.`);
}

main();
