"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { GalleryPhoto } from "@/lib/bobbleheadGallery";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
import { PhotoLightbox } from "@/components/PhotoLightbox";

// One photo's edit controls, spelled out rather than hung on the thumbnail as
// glyphs. The corner ✕ this replaces was unlabeled and — because it rendered
// for anyone with edit rights, all the time — read as a broken-image marker
// sitting on every photo.
function ManageControls({
  photo,
  isCurrentMain,
  onDelete,
  onSetAsMain,
  onReplace,
}: {
  photo: GalleryPhoto;
  isCurrentMain: boolean;
  onDelete?: (photo: GalleryPhoto) => void;
  onSetAsMain?: (photo: GalleryPhoto) => void;
  onReplace?: (photo: GalleryPhoto, file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const buttonClass =
    "rounded border border-border-soft bg-white px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-navy transition hover:border-accent hover:text-accent";

  return (
    <div className="mt-1 flex w-20 flex-wrap justify-center gap-1">
      {onSetAsMain && !isCurrentMain ? (
        <button type="button" onClick={() => onSetAsMain(photo)} className={buttonClass}>
          Main
        </button>
      ) : null}
      {onReplace ? (
        <>
          <button type="button" onClick={() => fileInputRef.current?.click()} className={buttonClass}>
            Swap
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Reset so picking the same file twice still fires a change.
              event.target.value = "";
              if (file) onReplace(photo, file);
            }}
          />
        </>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={() => onDelete(photo)}
          className="rounded border border-red-400/60 bg-red-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-500 transition hover:bg-red-500 hover:text-white"
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}

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
            <ManageControls
              photo={photo}
              isCurrentMain={photo.imageUrl === currentMainUrl}
              onDelete={onDelete}
              onSetAsMain={onSetAsMain}
              onReplace={onReplace}
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
