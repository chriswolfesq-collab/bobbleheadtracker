"use client";

import Image from "next/image";
import { useState } from "react";
import type { GalleryPhoto } from "@/lib/bobbleheadGallery";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { PhotoManageControls } from "@/components/PhotoManageControls";

export function PhotoGallery({
  photos,
  isManaging = false,
  currentMainUrl = null,
  onDelete,
  onSetAsMain,
  onReplace,
}: {
  photos: GalleryPhoto[];
  // Edit rights alone don't put the controls on screen — an admin or rep has to
  // turn management on for the listing they're actually working on.
  isManaging?: boolean;
  // The photo currently serving as the listing's profile image, if it's one of
  // these; it doesn't get a "make this the main photo" button.
  currentMainUrl?: string | null;
  onDelete?: (photo: GalleryPhoto) => void;
  onSetAsMain?: (photo: GalleryPhoto) => void;
  onReplace?: (photo: GalleryPhoto, file: File) => void;
}) {
  // Index of the photo being viewed full-screen; null when the lightbox is closed.
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((photo, index) => (
        <div key={photo.id} className="flex flex-col items-center">
          <button
            type="button"
            aria-label="Enlarge this photo"
            onClick={() => setZoomedIndex(index)}
            className={`block h-20 w-20 shrink-0 overflow-hidden rounded border bg-black/30 transition hover:border-accent ${
              isManaging && photo.imageUrl === currentMainUrl
                ? "border-accent"
                : "border-black/10"
            }`}
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
          {isManaging ? (
            <PhotoManageControls
              isCurrentMain={photo.imageUrl === currentMainUrl}
              onSetAsMain={onSetAsMain ? () => onSetAsMain(photo) : undefined}
              onReplace={onReplace ? (file) => onReplace(photo, file) : undefined}
              onDelete={onDelete ? () => onDelete(photo) : undefined}
            />
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
