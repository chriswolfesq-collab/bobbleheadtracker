import { readdir } from "node:fs/promises";
import sharp from "sharp";

// crop-bobbleheads-v2.mjs sliced the 30 figures out of a 10x3 sprite sheet on a
// fixed grid, so a few cells kept a sliver of the neighbouring figure against
// their left or right edge. sharp's trim() could not remove it: the sliver
// touches the border, so the cutout still reaches the canvas edge and there is
// nothing uniform to trim away. Those slivers render as thin dark marks beside
// the figure wherever the PNGs are used.
//
// This drops any run of content that is detached from the figure and crops the
// canvas horizontally to what is left. Height is untouched, so the figures keep
// standing on the same baseline. Idempotent — a file with one run is skipped.
const DIR = "public/bobbleheads";
const ALPHA_FLOOR = 8;

function contentRuns(data, width, height, channels) {
  const runs = [];
  let start = null;
  for (let x = 0; x < width; x++) {
    let filled = false;
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * channels + 3] > ALPHA_FLOOR) {
        filled = true;
        break;
      }
    }
    if (filled && start === null) start = x;
    if (!filled && start !== null) {
      runs.push([start, x - 1]);
      start = null;
    }
  }
  if (start !== null) runs.push([start, width - 1]);
  return runs;
}

async function main() {
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".png")).sort();
  let cleaned = 0;

  for (const file of files) {
    const path = `${DIR}/${file}`;
    const { data, info } = await sharp(path)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const runs = contentRuns(data, info.width, info.height, info.channels);
    if (runs.length < 2) continue;

    const [left, right] = runs.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
    const strays = runs.filter((r) => r[0] !== left);
    await sharp(path)
      .extract({ left, top: 0, width: right - left + 1, height: info.height })
      .toFile(`${path}.tmp`);
    await sharp(`${path}.tmp`).toFile(path);
    await (await import("node:fs/promises")).unlink(`${path}.tmp`);

    cleaned++;
    console.log(
      `${file}: dropped ${strays.map(([a, b]) => `${a}-${b}`).join(", ")}, ` +
        `${info.width}x${info.height} -> ${right - left + 1}x${info.height}`,
    );
  }

  console.log(`Cleaned ${cleaned} of ${files.length} figures.`);
}

main();
