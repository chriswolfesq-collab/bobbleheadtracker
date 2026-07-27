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
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  const [isZoomed, setIsZoomed] = useState(false);

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
        />
      </button>

      {isZoomed ? (
        <PhotoLightbox photos={[{ url: src, alt }]} onClose={() => setIsZoomed(false)} />
      ) : null}
    </>
  );
}
