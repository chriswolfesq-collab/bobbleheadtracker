"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useState } from "react";

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
  ...props
}: ImageProps & { eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);

  // A cached image can finish loading before React attaches `onLoad`, so also
  // check `complete` the moment the element mounts.
  const setRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) setLoaded(true);
  }, []);

  return (
    <>
      {loaded ? null : (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-pulse rounded bg-white/[0.06]"
        />
      )}
      <Image
        {...props}
        alt={alt}
        ref={setRef}
        loading={eager ? "eager" : "lazy"}
        onLoad={(event) => {
          setLoaded(true);
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
