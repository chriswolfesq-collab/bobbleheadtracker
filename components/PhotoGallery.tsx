"use client";

import Image from "next/image";

export function PhotoGallery({ photos }: { photos: string[] }) {
  if (photos.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((photoUrl) => (
        <a
          key={photoUrl}
          href={photoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="h-20 w-20 shrink-0 overflow-hidden rounded border border-white/15 bg-black/30 transition hover:border-amber-400"
        >
          <Image
            src={photoUrl}
            alt="Community-submitted photo"
            width={80}
            height={80}
            unoptimized
            className="h-full w-full object-cover"
          />
        </a>
      ))}
    </div>
  );
}
