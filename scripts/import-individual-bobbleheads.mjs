import sharp from "sharp";
import fs from "node:fs";

const SRC_DIR = "images/BobbleheadsNoBackgrounds";
const OUT_DIR = "public/bobbleheads";

// map source filename (without .png) -> our slug
const FILE_TO_SLUG = {
  angels: "angels",
  astros: "astros",
  athletics: "athletics",
  bluejays: "blue-jays",
  braves: "braves",
  brewers: "brewers",
  cardinals: "cardinals",
  cubs: "cubs",
  diamondbacks: "diamondbacks",
  dodgers: "dodgers",
  giants: "giants",
  guardians: "guardians",
  mariners: "mariners",
  marlins: "marlins",
  mets: "mets",
  nationals: "nationals",
  orioles: "orioles",
  padres: "padres",
  phillies: "phillies",
  pirates: "pirates",
  rangers: "rangers",
  rays: "rays",
  rcokies: "rockies",
  reds: "reds",
  redsox: "red-sox",
  royals: "royals",
  tigers: "tigers",
  twins: "twins",
  whitesox: "white-sox",
  yankees: "yankees",
};

async function main() {
  const results = {};
  for (const [file, slug] of Object.entries(FILE_TO_SLUG)) {
    const buf = await sharp(`${SRC_DIR}/${file}.png`).trim({ threshold: 10 }).toBuffer();
    await sharp(buf).toFile(`${OUT_DIR}/${slug}.png`);
    const meta = await sharp(buf).metadata();
    results[slug] = { w: meta.width, h: meta.height, ratio: +(meta.width / meta.height).toFixed(3) };
  }
  console.log(JSON.stringify(results, null, 2));
}

main();
