// Installs public/team-banners/<slug>.png — the photo card that heads each team
// page (app/teams/[slug]/TeamPageClient.tsx) — from a folder of source images,
// and regenerates lib/teamBanners.ts with the pixel size of each one.
//
// Run:  node scripts/import-team-banners.mjs [source-dir]
//       (defaults to ~/Documents/headerimages)
//
// A source file is matched to a team by name with the dashes dropped, so
// redsox.png, red-sox.png and RedSox.png all land on the red-sox slug.
//
// Two things happen to each image on the way in:
//
//  1. Several sources are drawn as a rounded card on a white page, which would
//     show as white slivers inside the page's own rounded corners. The white
//     arc is measured at each corner and cropped off, so the art bleeds to the
//     edge and the page's radius is the only one visible.
//
//  2. The PNG is re-encoded losslessly at full compression — the sources run
//     ~2MB each, which is a lot to carry in git for bytes the image optimizer
//     re-encodes before they ever reach a browser.
//
// Each card keeps the aspect ratio it arrived with — the trim above is fitted
// back to it rather than allowed to reshape the art. Shapes are not otherwise
// normalized here: the page heads every team with one fixed 2.4:1 box and
// covers it, so a source that isn't that shape is cropped at render, and
// lib/teamBanners.ts carries each card's real size to reserve the box with.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = process.argv[2] ?? join(homedir(), 'Documents', 'headerimages');
const OUT = join(root, 'public', 'team-banners');

// Read the slugs from the same file the page reads them from, so a team added
// there is a team this script expects art for.
const teamsSource = await readFile(join(root, 'lib', 'teams.ts'), 'utf8');
const SLUGS = [...teamsSource.matchAll(/^\s*\{\s*slug:\s*"([^"]+)"/gm)].map((m) => m[1]);
if (SLUGS.length !== 30) throw new Error(`expected 30 slugs in lib/teams.ts, parsed ${SLUGS.length}`);

const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const sources = new Map();
for (const file of await readdir(SRC)) {
  if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
  sources.set(key(parse(file).name), join(SRC, file));
}

const missing = SLUGS.filter((slug) => !sources.has(key(slug)));
if (missing.length) throw new Error(`no source image for: ${missing.join(', ')}`);

await mkdir(OUT, { recursive: true });

// How far the white page shows in from a corner, along both edges meeting it.
// Zero for art that already bleeds to the edge.
async function whiteInset(path) {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  const white = (x, y) => {
    const i = (y * info.width + x) * info.channels;
    return data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235;
  };
  let inset = 0;
  for (const [cx, cy] of [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]]) {
    if (!white(cx, cy)) continue;
    const stepX = cx === 0 ? 1 : -1;
    const stepY = cy === 0 ? 1 : -1;
    let run = 0;
    while (run < info.height && white(cx, cy + run * stepY)) run++;
    let across = 0;
    while (across < info.width && white(cx + across * stepX, cy)) across++;
    // +2 for the antialiased pixel or two at the end of the arc.
    inset = Math.max(inset, run + 2, across + 2);
  }
  return inset;
}

const dims = [];
for (const slug of SLUGS) {
  const src = sources.get(key(slug));
  const meta = await sharp(src).metadata();
  const inset = await whiteInset(src);
  let left = inset;
  let top = inset;
  let width = meta.width - 2 * inset;
  let height = meta.height - 2 * inset;

  // Cutting the white takes the same count of pixels off all four edges, which
  // leaves a wide card wider than it started: 1942x809 comes back 1906x773,
  // 2.47:1 rather than 2.4:1. The header is one fixed shape, so that drift is
  // only something the page crops back off at render. Take it here instead,
  // measured against the source's own ratio, and what lands on disk is already
  // the shape the page asks for.
  const ratio = meta.width / meta.height;
  if (width / height > ratio) {
    const fitted = Math.round(height * ratio);
    left += Math.round((width - fitted) / 2);
    width = fitted;
  } else if (width / height < ratio) {
    const fitted = Math.round(width / ratio);
    top += Math.round((height - fitted) / 2);
    height = fitted;
  }

  await sharp(src)
    .extract({ left, top, width, height })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(join(OUT, `${slug}.png`));
  dims.push({ slug, width, height });
  console.log(`${slug.padEnd(14)} ${width}x${height}${inset ? `  (trimmed ${inset}px of white)` : ''}`);
}

const body = dims.map((d) => `  "${d.slug}": { width: ${d.width}, height: ${d.height} },`).join('\n');
await writeFile(
  join(root, 'lib', 'teamBanners.ts'),
  `// Generated by scripts/import-team-banners.mjs — do not edit by hand.
//
// The pixel size of every public/team-banners/<slug>.png. The team page needs a
// width and height on the <Image> to reserve the box before the bytes land, and
// the cards aren't all the same shape, so a single hardcoded pair would squash
// the tall ones.
export const TEAM_BANNERS: Record<string, { width: number; height: number }> = {
${body}
};
`,
  'utf8',
);
console.log(`\nwrote lib/teamBanners.ts (${dims.length} teams)`);
