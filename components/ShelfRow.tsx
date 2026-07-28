import Image from "next/image";
import type { ReactNode } from "react";
import { publicAsset } from "@/lib/paths";

// A full-width photographed shelf plank (public/shelf-plank.jpg) with items
// standing on it. The plank spans the whole row — matching the homepage
// mockup — while the items scroll along it; each item's caption hangs below
// the plank, so `captionHeight` tells the plank how far up to sit.
const PLANK_HEIGHT = 24;

export function ShelfRow({
  captionHeight,
  children,
  className,
}: {
  /** px height reserved under the plank for item captions */
  captionHeight: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        aria-hidden
        className="absolute inset-x-0"
        style={{ bottom: captionHeight, height: PLANK_HEIGHT }}
      >
        <Image
          src={publicAsset("/shelf-plank.jpg")}
          alt=""
          fill
          sizes="100vw"
          className="rounded-sm object-fill shadow-[0_5px_8px_rgba(58,36,18,0.25)]"
        />
      </div>
      <div className="relative flex items-end gap-5 overflow-x-auto px-4 sm:gap-7 sm:px-8">
        {children}
      </div>
    </div>
  );
}

// Standard wrapper for one item on the shelf: the visual stands with its feet
// on the plank (margin equal to the plank height, minus a hair so it visually
// touches), the caption hangs below.
export function ShelfItem({
  visual,
  caption,
  captionHeight,
}: {
  visual: ReactNode;
  caption: ReactNode;
  captionHeight: number;
}) {
  return (
    <div className="flex shrink-0 snap-start flex-col items-center">
      <div style={{ marginBottom: PLANK_HEIGHT - 3 }} className="flex items-end">
        {visual}
      </div>
      <div style={{ height: captionHeight }} className="flex w-full flex-col items-center pt-3">
        {caption}
      </div>
    </div>
  );
}
