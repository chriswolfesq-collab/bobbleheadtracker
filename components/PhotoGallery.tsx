"use client";

import Image from "next/image";
import { useState } from "react";
import type { GalleryPhoto } from "@/lib/bobbleheadGallery";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
import { PhotoLightbox } from "@/components/PhotoLightbox";

export function PhotoGallery({
  photos,
  onDelete,
  onSetAsMain,
}: {
  photos: GalleryPhoto[];
  // Provided only in admin mode; renders a remove button on each photo.
  onDelete?: (photo: GalleryPhoto) => void;
  // Provided only in admin mode; renders a "set as profile photo" button.
  onSetAsMain?: (photo: GalleryPhoto) => void;
}) {
  // Index of the photo being viewed full-screen; null when the lightbox is closed.
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((photo, index) => (
        <div key={photo.id} className="relative">
          <button
            type="button"
            aria-label="Enlarge this photo"
            onClick={() => setZoomedIndex(index)}
            className="block h-20 w-20 shrink-0 overflow-hidden rounded border border-black/10 bg-black/30 transition hover:border-accent dark:border-white/15"
          >
            <Image
              src={photo.imageUrl}
              alt="Community-submitted photo"
              width={80}
              height={80}
              unoptimized={isUnoptimizedImage(photo.imageUrl)}
              className="h-full w-full object-cover"
            />
          </button>
          {onSetAsMain ? (
            <button
              type="button"
              aria-label="Set as profile photo"
              title="Set as profile photo"
              onClick={() => onSetAsMain(photo)}
              className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-accent/70 bg-white text-[10px] font-black text-accent transition hover:bg-accent hover:text-accent-fg dark:bg-[#0b1a29]"
            >
              ★
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              aria-label="Remove this photo"
              title="Remove this photo"
              onClick={() => onDelete(photo)}
              className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-red-400/60 bg-red-50 text-[10px] font-black text-red-500 transition hover:bg-red-500 hover:text-white dark:bg-[#2a1013] dark:text-red-300"
            >
              ✕
            </button>
          ) : null}
        </div>
      ))}

      {zoomedIndex !== null ? (
        <PhotoLightbox
          photos={photos.map((photo) => ({ url: photo.imageUrl, alt: "Community-submitted photo" }))}
          startIndex={zoomedIndex}
          onClose={() => setZoomedIndex(null)}
        />
      ) : null}
    </div>
  );
}
