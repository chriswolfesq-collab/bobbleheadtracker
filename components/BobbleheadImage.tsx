"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

// Remote bobblehead photos are served unoptimized and can take a moment to
// arrive; with nothing behind them the empty <img> box reads as a *broken*
// image. This wraps next/image with a pulsing skeleton that fills its parent
// (which must be positioned `relative`) until the image loads or errors out.
//
// Next 16 deprecated the `priority` prop, so above-the-fold callers pass
// `eager` and we set `loading="eager"` instead.
export function BobbleheadImage({
  eager = false,
  alt,
  onLoad,
  onError,
  onNaturalSize,
  ...props
}: ImageProps & {
  eager?: boolean;
  /**
   * Fires once the real pixel dimensions are known, from whichever of the two
   * paths below gets there first. Callers that need the photo's true aspect
   * ratio use this — naturalWidth/naturalHeight are divided by the device pixel
   * ratio, so the individual numbers aren't meaningful, but their ratio is.
   */
  onNaturalSize?: (naturalWidth: number, naturalHeight: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  // Held in a ref so an inline arrow from the caller doesn't change `setRef`'s
  // identity every render, which would make React detach and reattach the ref
  // (and re-run the mount branch) on each pass.
  const onNaturalSizeRef = useRef(onNaturalSize);
  useEffect(() => {
    onNaturalSizeRef.current = onNaturalSize;
  }, [onNaturalSize]);

  const report = useCallback((node: HTMLImageElement) => {
    if (node.naturalWidth > 0 && node.naturalHeight > 0) {
      onNaturalSizeRef.current?.(node.naturalWidth, node.naturalHeight);
    }
  }, []);

  // A cached image can finish loading before React attaches `onLoad`, so also
  // check `complete` the moment the element mounts. Both paths report the size:
  // a cached photo never fires onLoad, and without this its dimensions would
  // never arrive.
  const setRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete) {
        setLoaded(true);
        report(node);
      }
    },
    [report],
  );

  return (
    <>
      {loaded ? null : (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-pulse rounded bg-black/[0.06]"
        />
      )}
      <Image
        {...props}
        alt={alt}
        ref={setRef}
        loading={eager ? "eager" : "lazy"}
        onLoad={(event) => {
          setLoaded(true);
          report(event.currentTarget);
          onLoad?.(event);
        }}
        onError={(event) => {
          setLoaded(true);
          onError?.(event);
        }}
      />
    </>
  );
}
