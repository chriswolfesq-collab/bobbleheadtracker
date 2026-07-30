/**
 * Pixel dimensions read straight out of an image's header bytes.
 *
 * Exists for the generated OG cards: Satori needs an explicit width and height
 * on every <img>, and giving every photo the same box letterboxes the wide ones
 * inside a tall frame. Listing photos are every shape and most are remote, so
 * the shape isn't known until the bytes are in hand — at which point the header
 * is right there. Covers PNG, JPEG and WebP, which is every format in the
 * catalog; anything else returns null and the caller falls back to a fixed box.
 */
export type ImageDimensions = { width: number; height: number };

function readPng(buffer: Buffer): ImageDimensions | null {
  // \x89PNG\r\n\x1a\n, then the IHDR chunk, whose width/height are the first
  // two big-endian uint32s of its data at offset 16.
  if (buffer.length < 24) return null;
  if (buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpeg(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    // Segments start with 0xFF; runs of fill bytes are legal, so skip them.
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    // Any Start Of Frame holds the real size. 0xC4/0xC8/0xCC sit in the same
    // range but are Huffman/arithmetic tables, not frame headers.
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    if (length < 2) return null; // malformed; don't loop forever
    offset += 2 + length;
  }
  return null;
}

function readWebp(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buffer.toString("ascii", 8, 12) !== "WEBP") return null;

  const chunk = buffer.toString("ascii", 12, 16);

  if (chunk === "VP8X") {
    // Extended format: canvas size is stored as (dimension - 1) in 24-bit LE.
    const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
    const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
    return { width, height };
  }

  if (chunk === "VP8 ") {
    // Lossy: after the 3-byte start code the 14 low bits of each uint16 are the
    // dimensions; the top 2 bits are a scaling hint we don't need.
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunk === "VP8L") {
    // Lossless: 14 bits each, packed little-endian after the 1-byte signature.
    const bits = buffer.readUInt32LE(21);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >> 14) & 0x3fff),
    };
  }

  return null;
}

export function imageDimensions(buffer: Buffer): ImageDimensions | null {
  const result = readPng(buffer) ?? readJpeg(buffer) ?? readWebp(buffer);
  if (!result) return null;
  if (!Number.isFinite(result.width) || !Number.isFinite(result.height)) return null;
  if (result.width <= 0 || result.height <= 0) return null;
  return result;
}

/**
 * The largest box with `dimensions`' aspect ratio that fits inside the given
 * envelope. `maxScale` caps how far a source smaller than the envelope may be
 * enlarged to fill it — some upscaling is worth it on a card that gets viewed at
 * half size in a feed, but a thumbnail-sized source blown up to a hero is just
 * a blurry mess.
 */
export function fitWithin(
  dimensions: ImageDimensions,
  maxWidth: number,
  maxHeight: number,
  maxScale = 1,
): ImageDimensions {
  const scale = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height, maxScale);
  return {
    width: Math.round(dimensions.width * scale),
    height: Math.round(dimensions.height * scale),
  };
}
