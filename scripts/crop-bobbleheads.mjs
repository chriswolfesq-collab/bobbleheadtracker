import sharp from "sharp";
import fs from "node:fs";

const SRC = "images/bobbleheads.png";
const COLS = 10;
const ROWS = 3;
const INSET = 5; // trim the white cell gutter

const ORDER = [
  ["diamondbacks", "braves", "orioles", "red-sox", "cubs", "white-sox", "reds", "guardians", "rockies", "tigers"],
  ["astros", "royals", "angels", "dodgers", "marlins", "brewers", "twins", "mets", "yankees", "athletics"],
  ["phillies", "pirates", "padres", "giants", "mariners", "cardinals", "rays", "rangers", "blue-jays", "nationals"],
];

const CONNECT_THRESHOLD = 20; // strict seed pass — only true backdrop should connect through this
const GROW_THRESHOLD = 30; // relaxed second pass, but only adjacent to confirmed background

async function main() {
  const { width: fullW, height: fullH } = await sharp(SRC).metadata();
  const cellW = fullW / COLS;
  const cellH = fullH / ROWS;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const slug = ORDER[row][col];
      const left = Math.round(col * cellW) + INSET;
      const top = Math.round(row * cellH) + INSET;
      const width = Math.round(cellW) - INSET * 2;
      const height = Math.round(cellH) - INSET * 2;

      const { data, info } = await sharp(SRC)
        .extract({ left, top, width, height })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { width: w, height: h, channels: ch } = info;
      const out = Buffer.alloc(w * h * 4);

      // per-row background reference, sampled independently from the left and
      // right margins (the studio lighting falls off left-to-right, so the
      // backdrop itself is a horizontal gradient, not a flat color)
      const margin = 7;
      const sampleEdge = (y, fromLeft) => {
        let r = 0, g = 0, b = 0, n = 0;
        const xs = fromLeft
          ? Array.from({ length: margin - 2 }, (_, k) => 2 + k)
          : Array.from({ length: margin - 2 }, (_, k) => w - 3 - k);
        for (const x of xs) {
          const i = (y * w + x) * ch;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        return [r / n, g / n, b / n];
      };
      const leftRef = new Array(h);
      const rightRef = new Array(h);
      for (let y = 0; y < h; y++) {
        leftRef[y] = sampleEdge(y, true);
        rightRef[y] = sampleEdge(y, false);
      }

      // distance-to-local-background per pixel (a continuous "how background-y" score)
      const dist = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        const [lr, lg, lb] = leftRef[y];
        const [rr, rg, rb] = rightRef[y];
        for (let x = 0; x < w; x++) {
          const t = x / (w - 1);
          const er = lr + (rr - lr) * t;
          const eg = lg + (rg - lg) * t;
          const eb = lb + (rb - lb) * t;
          const i = (y * w + x) * ch;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          dist[y * w + x] = Math.sqrt((r - er) ** 2 + (g - eg) ** 2 + (b - eb) ** 2);
        }
      }

      // flood fill from the border through pixels close to the local backdrop
      // estimate — this way a white jersey in the middle of the frame never
      // gets erased just because it happens to be a similar color to the wall
      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let qHead = 0, qTail = 0;
      const pushIfCandidate = (x, y) => {
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        const idx = y * w + x;
        if (visited[idx]) return;
        if (dist[idx] <= CONNECT_THRESHOLD) {
          visited[idx] = 1;
          queue[qTail++] = idx;
        }
      };
      for (let x = 0; x < w; x++) {
        pushIfCandidate(x, 0);
        pushIfCandidate(x, h - 1);
      }
      for (let y = 0; y < h; y++) {
        pushIfCandidate(0, y);
        pushIfCandidate(w - 1, y);
      }
      while (qHead < qTail) {
        const idx = queue[qHead++];
        const x = idx % w, y = (idx / w) | 0;
        pushIfCandidate(x + 1, y);
        pushIfCandidate(x - 1, y);
        pushIfCandidate(x, y + 1);
        pushIfCandidate(x, y - 1);
      }

      // second, relaxed pass (hysteresis): grow the confirmed-background region
      // outward using a looser threshold, but only through pixels already
      // touching confirmed background — cleans up soft halo remnants without
      // letting the fill leak deep into the subject through a stray bridge
      const pushIfGrow = (x, y) => {
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        const idx = y * w + x;
        if (visited[idx]) return;
        if (dist[idx] <= GROW_THRESHOLD) {
          visited[idx] = 1;
          queue[qTail++] = idx;
        }
      };
      qHead = 0; // replay the confirmed-background frontier through the relaxed test
      while (qHead < qTail) {
        const idx = queue[qHead++];
        const x = idx % w, y = (idx / w) | 0;
        pushIfGrow(x + 1, y);
        pushIfGrow(x - 1, y);
        pushIfGrow(x, y + 1);
        pushIfGrow(x, y - 1);
      }

      // binary mask from the flood fill, then a tiny box blur on the alpha
      // channel only, so cutout edges aren't razor-jagged
      const alphaBinary = new Float32Array(w * h);
      for (let idx = 0; idx < w * h; idx++) alphaBinary[idx] = visited[idx] ? 0 : 255;

      const RADIUS = 1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sum = 0, n = 0;
          for (let dy = -RADIUS; dy <= RADIUS; dy++) {
            for (let dx = -RADIUS; dx <= RADIUS; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
              sum += alphaBinary[ny * w + nx];
              n++;
            }
          }
          const idx = y * w + x;
          const i = idx * ch;
          const o = idx * 4;
          out[o] = data[i]; out[o + 1] = data[i + 1]; out[o + 2] = data[i + 2];
          out[o + 3] = Math.round(sum / n);
        }
      }

      await sharp(out, { raw: { width: w, height: h, channels: 4 } })
        .png()
        .toFile(`public/bobbleheads/${slug}.png`);
    }
  }
  console.log("Done cropping 30 bobbleheads.");
}

main();
