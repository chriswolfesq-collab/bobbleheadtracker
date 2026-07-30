import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fitWithin, imageDimensions } from "@/lib/imageDimensions";

const publicDir = join(process.cwd(), "public");

describe("imageDimensions", () => {
  it("reads a PNG header", () => {
    // A real team figure, so the test breaks if the parser drifts from reality.
    const buffer = readFileSync(join(publicDir, "bobbleheads/yankees.png"));
    expect(imageDimensions(buffer)).toEqual({ width: 707, height: 1688 });
  });

  it("reads a JPEG header", () => {
    const buffer = readFileSync(join(publicDir, "shelf-plank-art.jpg"));
    expect(imageDimensions(buffer)).toEqual({ width: 996, height: 74 });
  });

  it("returns null for bytes that aren't an image", () => {
    expect(imageDimensions(Buffer.from("this is not an image at all"))).toBeNull();
  });

  it("returns null rather than looping on a truncated JPEG", () => {
    // SOI followed by a segment whose length runs off the end.
    expect(imageDimensions(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBeNull();
  });
});

describe("fitWithin", () => {
  it("shrinks a large photo to the envelope, keeping its ratio", () => {
    expect(fitWithin({ width: 2000, height: 1000 }, 460, 534)).toEqual({
      width: 460,
      height: 230,
    });
  });

  it("is bounded by height for a tall photo", () => {
    expect(fitWithin({ width: 1000, height: 2000 }, 460, 534)).toEqual({
      width: 267,
      height: 534,
    });
  });

  it("leaves a small photo alone by default", () => {
    expect(fitWithin({ width: 200, height: 150 }, 460, 534)).toEqual({
      width: 200,
      height: 150,
    });
  });

  it("enlarges up to maxScale but no further", () => {
    // Envelope alone would allow 2.3x; maxScale caps it at 1.6x.
    expect(fitWithin({ width: 200, height: 150 }, 460, 534, 1.6)).toEqual({
      width: 320,
      height: 240,
    });
  });
});
