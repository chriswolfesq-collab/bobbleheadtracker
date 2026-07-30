"use client";

import { useState } from "react";
import { BobbleheadImage } from "@/components/BobbleheadImage";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { isUnoptimizedImage } from "@/lib/imageOptimization";

// The profile photo in a bobblehead page hero, clickable to view full-screen.
// The button fills its parent (which supplies the size and the skeleton's
// positioning context) so the whole photo area is the hit target.
export function EnlargeablePhoto({
  src,
  alt,
  width,
  height,
  className,
  fitHeight,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  /**
   * Opt in to shape-aware sizing, capped at this many px tall. The photo then
   * fills the width its frame gives it, stopping when its height reaches the
   * cap, always at its true aspect ratio — so the frame ends up the shape of
   * the photo instead of boxing it.
   *
   * Why this can't be done in CSS alone: listing photos are every shape, and
   * `width`/`height` above are a fixed guess (the real ones aren't known
   * server-side — plenty of photos are remote URLs). Leaving both dimensions
   * `auto` looks right but resolves against the *intrinsic* size of whichever
   * srcset entry was picked, and next/image advertises widths the optimizer
   * won't deliver for a small source — it never upscales — so the browser
   * divides by a density that's too high and the photo lands at a fraction of
   * its size. Measuring the ratio sidesteps all of that: the individual
   * natural dimensions are unreliable, their ratio isn't.
   */
  fitHeight?: number;
}) {
  const [isZoomed, setIsZoomed] = useState(false);
  // Seeded from the caller's declared dimensions so the frame starts at a sane
  // shape, then corrected to the photo's real ratio the moment it's known.
  const [ratio, setRatio] = useState(width / height);

  const fitStyle =
    fitHeight === undefined
      ? undefined
      : {
          aspectRatio: String(ratio),
          width: "100%",
          maxWidth: `${Math.round(ratio * fitHeight)}px`,
          height: "auto" as const,
        };

  return (
    <>
      <button
        type="button"
        title="Click to enlarge"
        aria-label={`Enlarge photo: ${alt}`}
        onClick={() => setIsZoomed(true)}
        className="flex h-full w-full cursor-zoom-in items-end justify-center"
      >
        <BobbleheadImage
          src={src}
          alt={alt}
          width={width}
          height={height}
          eager
          unoptimized={isUnoptimizedImage(src)}
          className={className}
          style={fitStyle}
          onNaturalSize={
            fitHeight === undefined
              ? undefined
              : (naturalWidth, naturalHeight) => setRatio(naturalWidth / naturalHeight)
          }
        />
      </button>

      {isZoomed ? (
        <PhotoLightbox photos={[{ url: src, alt }]} onClose={() => setIsZoomed(false)} />
      ) : null}
    </>
  );
}
