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
  src,
  fallbackSrc,
  onLoad,
  onError,
  onNaturalSize,
  ...props
}: ImageProps & {
  eager?: boolean;
  /**
   * Shown instead of `src` if `src` fails to load — normally the team
   * placeholder the caller would have used had the listing carried no photo.
   *
   * Photos outlive nothing: a storage object gets deleted, a remote host
   * 404s, and the row still points at the old URL. Until the nightly dead-image
   * sweep and an admin catch up (see lib/deadImageSweep.ts), every card for
   * that listing renders the browser's broken-image icon and its alt text.
   * Falling back keeps a dead URL looking like a listing with no photo yet,
   * which is what it has effectively become.
   */
  fallbackSrc?: string;
  /**
   * Fires once the real pixel dimensions are known, from whichever of the two
   * paths below gets there first. Callers that need the photo's true aspect
   * ratio use this — naturalWidth/naturalHeight are divided by the device pixel
   * ratio, so the individual numbers aren't meaningful, but their ratio is.
   */
  onNaturalSize?: (naturalWidth: number, naturalHeight: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // A recycled component (a card list re-keyed by a filter change) has to give
  // the new photo its own chance to load rather than inheriting the old one's
  // verdict. Compared during render — the same "adjust state during render"
  // pattern the filter windows use — so the swap never paints the fallback
  // under the new `src`. `loaded` deliberately isn't reset: a cached photo
  // fires no second onLoad, and clearing it would strand the skeleton on top.
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setFailed(false);
  }

  const resolvedSrc = failed && fallbackSrc ? fallbackSrc : src;

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
        src={resolvedSrc}
        alt={alt}
        ref={setRef}
        loading={eager ? "eager" : "lazy"}
        onLoad={(event) => {
          setLoaded(true);
          report(event.currentTarget);
          onLoad?.(event);
        }}
        onError={(event) => {
          // Not a final failure yet — the fallback still has to load, so hold
          // the skeleton and stay quiet toward the caller until it settles.
          if (fallbackSrc && !failed && fallbackSrc !== src) {
            setFailed(true);
            return;
          }
          setLoaded(true);
          onError?.(event);
        }}
      />
    </>
  );
}
