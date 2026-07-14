import sharp from "sharp";

const SRC = "images/bobbleheadsnobackground.png";
const COLS = 10;
const ROWS = 3;

const ORDER = [
  ["diamondbacks", "braves", "orioles", "red-sox", "cubs", "white-sox", "reds", "guardians", "rockies", "tigers"],
  ["astros", "royals", "angels", "dodgers", "marlins", "brewers", "twins", "mets", "yankees", "athletics"],
  ["phillies", "pirates", "padres", "giants", "mariners", "cardinals", "rays", "rangers", "blue-jays", "nationals"],
];

async function main() {
  const trimmed = sharp(SRC).trim({ threshold: 10 });
  const { data, info } = await trimmed.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const cellW = width / COLS;
  const cellH = height / ROWS;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const slug = ORDER[row][col];
      const left = Math.round(col * cellW);
      const top = Math.round(row * cellH);
      const w = Math.round(cellW);
      const h = Math.round(cellH);

      const cellBuf = await sharp(data, { raw: { width, height, channels } })
        .extract({ left, top, width: w, height: h })
        .png()
        .toBuffer();

      const finalBuf = await sharp(cellBuf).trim({ threshold: 10 }).toBuffer();
      await sharp(finalBuf).toFile(`public/bobbleheads/${slug}.png`);
    }
  }
  console.log("Done cropping 30 bobbleheads (v2, clean alpha source).");
}

main();
