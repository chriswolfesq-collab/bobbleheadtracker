// Builds public/shelf-filled.png — the empty shelf (shelf-even.jpg) with all 30
// team bobbleheads composited onto it, matching how components/DisplayCase.tsx
// positions them in the app. Used as the hero image in the branded auth emails
// (supabase/email-templates/*.html), where we can't run the app's layout.
//
// Run:  node scripts/build-shelf-filled.mjs
//
// Geometry mirrors DisplayCase.tsx exactly:
//   - canvas is shelf-even.jpg's native size (1024x1538)
//   - each bobblehead is 11% of canvas height, width auto by the PNG's aspect
//   - horizontal center sits at SLOT_X% (5 evenly spaced slots per shelf)
//   - the bobblehead's BOTTOM edge sits at floor% from the top of the canvas
// Re-run this whenever the shelf art, the team PNGs, or those numbers change.

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");

// Matches DisplayCase.tsx.
const SLOT_X = [14, 32, 50, 68, 86];
const BOBBLEHEAD_SLOT_HEIGHT = 0.11; // 11% of canvas height

// Shelf floors (top → bottom) with the teams that stand on each, in the same
// order DisplayCase derives via TEAMS.filter(league && division).
const SHELVES = [
  { floor: 25.2, teams: ["orioles", "red-sox", "yankees", "rays", "blue-jays"] },
  { floor: 39.1, teams: ["white-sox", "guardians", "tigers", "royals", "twins"] },
  { floor: 53.0, teams: ["astros", "angels", "athletics", "mariners", "rangers"] },
  { floor: 66.9, teams: ["braves", "marlins", "mets", "phillies", "nationals"] },
  { floor: 80.8, teams: ["cubs", "reds", "brewers", "pirates", "cardinals"] },
  { floor: 94.7, teams: ["diamondbacks", "rockies", "dodgers", "padres", "giants"] },
];

const base = sharp(join(pub, "shelf-even.jpg"));
const { width: W, height: H } = await base.metadata();

const targetH = Math.round(H * BOBBLEHEAD_SLOT_HEIGHT);

const composites = [];
for (const { floor, teams } of SHELVES) {
  const bottomPx = (floor / 100) * H; // bottom edge of the bobblehead, from top
  for (let i = 0; i < teams.length; i++) {
    const slug = teams[i];
    const src = join(pub, "bobbleheads", `${slug}.png`);

    // Resize to the shared height; width follows the PNG's own aspect ratio,
    // exactly like `h-full w-auto` in the app.
    const buf = await sharp(src)
      .resize({ height: targetH })
      .png()
      .toBuffer();
    const { width: w } = await sharp(buf).metadata();

    const centerX = (SLOT_X[i] / 100) * W;
    const left = Math.round(centerX - w / 2);
    const top = Math.round(bottomPx - targetH);

    composites.push({ input: buf, left, top });
  }
}

const out = join(pub, "shelf-filled.png");
await base.composite(composites).png().toFile(out);
console.log(`Wrote ${out} (${W}x${H}, ${composites.length} bobbleheads)`);
