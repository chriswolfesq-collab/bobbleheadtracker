"use client";

import { useState } from "react";
import { BobbleheadImage } from "@/components/BobbleheadImage";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
import { useDialog } from "@/lib/useDialog";

export type LightboxPhoto = { url: string; alt: string };

/**
 * Full-screen viewer for bobblehead photos. The caller only mounts it while
 * open, so it starts fresh (and on `startIndex`) every time. Escape, the focus
 * trap, and focus restore come from `useDialog`; the arrow keys move between
 * photos when the caller passes more than one.
 */
export function PhotoLightbox({
  photos,
  startIndex = 0,
  onClose,
}: {
  photos: LightboxPhoto[];
  startIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const panelRef = useDialog<HTMLDivElement>(true, onClose);

  const photo = photos[index];
  if (!photo) return null;

  const hasMultiple = photos.length > 1;
  const step = (delta: number) => setIndex((current) => (current + delta + photos.length) % photos.length);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Enlarged photo"
        className="relative flex h-full w-full max-w-5xl flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (!hasMultiple) return;
          if (event.key === "ArrowRight") step(1);
          else if (event.key === "ArrowLeft") step(-1);
        }}
      >
        {/* `fill` + object-contain scales the photo up to fill the viewport
            box whatever its intrinsic size — many catalog photos are small
            thumbnails that would otherwise open barely larger than the page. */}
        <div className="relative min-h-0 w-full flex-1">
          <BobbleheadImage
            key={photo.url}
            src={photo.url}
            alt={photo.alt}
            fill
            eager
            sizes="100vw"
            unoptimized={isUnoptimizedImage(photo.url)}
            className="object-contain"
          />
        </div>

        <div className="flex items-center gap-3">
          {hasMultiple ? (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => step(-1)}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/25 text-lg font-black text-white transition hover:border-accent hover:text-accent-hover"
              >
                ‹
              </button>
              <span className="text-xs font-black uppercase tracking-wide text-zinc-300">
                {index + 1} / {photos.length}
              </span>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => step(1)}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/25 text-lg font-black text-white transition hover:border-accent hover:text-accent-hover"
              >
                ›
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/25 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:border-accent hover:text-accent-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
