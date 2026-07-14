import { geoAlbersUsa } from "d3-geo";
import fs from "node:fs";
import { TEAM_COORDS } from "./team-coords.mjs";

const WIDTH = 975;
const HEIGHT = 610;

const projection = geoAlbersUsa().scale(1300).translate([487.5, 305]);

// raw Albers-projected position, converted straight to 0-100 percentages
const rawPoints = Object.entries(TEAM_COORDS).map(([slug, [lon, lat]]) => {
  const p = projection([lon, lat]);
  return { slug, x: (p[0] / WIDTH) * 100, y: (p[1] / HEIGHT) * 100 };
});

// the map art reserves its top ~20% for a title banner and has a decorative
// frame, so the idealized 0-100 Albers range needs squeezing into the actual
// visible landmass band before anything else.
for (const p of rawPoints) {
  p.y = 12 + p.y * 0.82;
}

// manual geographic nudges for the handful of two-team metros, applied
// *before* collision resolution so the repulsion pass has less work to do
// and moves things in a sensible direction (north/south, east/west) rather
// than an arbitrary one. Values are in final percentage points.
const NUDGE = {
  yankees: [-2, -3],
  mets: [3, 3],
  "white-sox": [-2, 3],
  cubs: [2, -3],
  giants: [-2.5, 2],
  athletics: [3, -2],
  dodgers: [-2, -2.5],
  angels: [3, 3],
};
for (const p of rawPoints) {
  const n = NUDGE[p.slug];
  if (n) { p.x += n[0]; p.y += n[1]; }
}

// bounding-box declutter, in the same final percentage space as rendering —
// marker cards render ~34x78px on a map that's roughly 700x467px, so use
// that footprint (plus a little breathing room) as the collision box.
// Priority here is zero overlap; staying near the true geographic spot is
// a soft preference (weak spring), not a hard constraint.
const MARKER_W_PCT = 5.0;
const MARKER_H_PCT = 17;
const ITERATIONS = 500;
const STEP = 0.35;
const SPRING = 0.008; // pull back toward the true/nudged geographic spot each iteration

const anchors = rawPoints.map((p) => ({ x: p.x, y: p.y }));

for (let iter = 0; iter < ITERATIONS; iter++) {
  let moved = false;
  for (let i = 0; i < rawPoints.length; i++) {
    for (let j = i + 1; j < rawPoints.length; j++) {
      const a = rawPoints[i];
      const b = rawPoints[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      if (dx === 0 && dy === 0) {
        dx = (i % 2 === 0 ? 1 : -1) * 0.01;
        dy = (j % 2 === 0 ? 1 : -1) * 0.01;
      }
      const overlapX = MARKER_W_PCT - Math.abs(dx);
      const overlapY = MARKER_H_PCT - Math.abs(dy);
      if (overlapX > 0 && overlapY > 0) {
        moved = true;
        if (overlapX < overlapY) {
          const push = (overlapX / 2 + 0.1) * STEP * Math.sign(dx || 1);
          a.x -= push; b.x += push;
        } else {
          const push = (overlapY / 2 + 0.1) * STEP * Math.sign(dy || 1);
          a.y -= push; b.y += push;
        }
      }
    }
  }
  // spring back toward the anchor point, and keep everyone on the visible map
  for (let i = 0; i < rawPoints.length; i++) {
    const p = rawPoints[i];
    const anchor = anchors[i];
    p.x += (anchor.x - p.x) * SPRING;
    p.y += (anchor.y - p.y) * SPRING;
    p.x = Math.max(-2, Math.min(103, p.x));
    p.y = Math.max(6, Math.min(100, p.y));
  }
  if (!moved) break;
}

// cool-down phase: pure repulsion, no spring, to fully clear any residual
// near-threshold overlap the spring equilibrium left behind
for (let iter = 0; iter < 600; iter++) {
  let moved = false;
  for (let i = 0; i < rawPoints.length; i++) {
    for (let j = i + 1; j < rawPoints.length; j++) {
      const a = rawPoints[i];
      const b = rawPoints[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      if (dx === 0 && dy === 0) { dx = 0.01; dy = 0.01; }
      const overlapX = MARKER_W_PCT - Math.abs(dx);
      const overlapY = MARKER_H_PCT - Math.abs(dy);
      if (overlapX > 0 && overlapY > 0) {
        moved = true;
        if (overlapX < overlapY) {
          const push = (overlapX / 2 + 0.15) * Math.sign(dx || 1);
          a.x -= push; b.x += push;
        } else {
          const push = (overlapY / 2 + 0.15) * Math.sign(dy || 1);
          a.y -= push; b.y += push;
        }
      }
    }
  }
  for (const p of rawPoints) {
    p.x = Math.max(-2, Math.min(103, p.x));
    p.y = Math.max(6, Math.min(100, p.y));
  }
  if (!moved) break;
}

const positions = Object.fromEntries(
  rawPoints.map(({ slug, x, y }) => [slug, { x: +x.toFixed(2), y: +y.toFixed(2) }])
);

fs.writeFileSync(
  new URL("./team-positions.json", import.meta.url),
  JSON.stringify(positions, null, 2)
);
console.log(JSON.stringify(positions, null, 2));
