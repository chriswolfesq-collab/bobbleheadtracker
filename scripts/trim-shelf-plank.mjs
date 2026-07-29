import sharp from "sharp";
import { unlink } from "node:fs/promises";

// public/shelf-plank.jpg was cropped out of a photo of a board hanging on a
// pale wall, and it kept a wedge of that wall above the board's mitred ends —
// 24 columns on the left, 21 on the right. ShelfRow stretches the plank across
// the whole row with object-fill, so those wedges stretch too and land as pale
// boxes at both ends of every shelf, next to the cream page background but not
// quite matching it.
//
// This crops the wall columns off so the board runs edge to edge. object-fill
// already decides the rendered width, so losing 45 columns changes nothing
// about the layout. Idempotent — a file whose corners are clean is skipped.
const PATH = "public/shelf-plank.jpg";

// The board is brown and mid-dark; the wall is light and near-neutral. Anything
// bright with little red-over-blue lead is wall rather than wood.
const isWall = (r, g, b) => r + g + b > 480 && r - b < 60;

function wallColumns(data, width, height, channels) {
  const wall = [];
  for (let x = 0; x < width; x++) {
    let found = false;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * channels;
      if (isWall(data[i], data[i + 1], data[i + 2])) {
        found = true;
        break;
      }
    }
    if (found) wall.push(x);
  }
  return wall;
}

const { data, info } = await sharp(PATH).raw().toBuffer({ resolveWithObject: true });
const wall = wallColumns(data, info.width, info.height, info.channels);

if (wall.length === 0) {
  console.log(`${PATH}: corners already clean, nothing to trim.`);
} else {
  // Only the two ends carry wall; take the first and last runs off the sides
  // rather than trusting a single global min/max, so a stray speck in the
  // middle of the board can never swallow the whole image.
  let left = 0;
  while (wall.includes(left)) left++;
  let right = info.width - 1;
  while (wall.includes(right)) right--;

  const width = right - left + 1;
  await sharp(PATH)
    .extract({ left, top: 0, width, height: info.height })
    .jpeg({ quality: 88 })
    .toFile(`${PATH}.tmp`);
  await sharp(`${PATH}.tmp`).jpeg({ quality: 88 }).toFile(PATH);
  await unlink(`${PATH}.tmp`);

  console.log(
    `${PATH}: dropped ${left} columns from the left and ` +
      `${info.width - 1 - right} from the right, ` +
      `${info.width}x${info.height} -> ${width}x${info.height}`,
  );
}
