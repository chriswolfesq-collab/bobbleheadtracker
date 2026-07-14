"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useUploadedBobbleheadPhoto } from "@/lib/uploadedPhotos";

export function UploadedBobbleheadImage({
  alt,
  bobbleheadId,
  className,
  fallbackSrc,
  height,
  priority,
  width,
}: {
  alt: string;
  bobbleheadId: string;
  className?: string;
  fallbackSrc: string;
  height: number;
  priority?: boolean;
  width: number;
}) {
  const { photoUrl } = useUploadedBobbleheadPhoto(bobbleheadId);

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        className={className}
      />
    );
  }

  return (
    <Image
      src={fallbackSrc}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}

export function UploadPhotoButton({
  bobbleheadId,
  className,
  children,
  label,
  onUploaded,
}: {
  bobbleheadId: string;
  children?: ReactNode;
  className: string;
  label: string;
  onUploaded?: () => void;
}) {
  const { savePhoto } = useUploadedBobbleheadPhoto(bobbleheadId);

  return (
    <label className={className}>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          if (!file) return;

          await savePhoto(file);
          event.currentTarget.value = "";
          onUploaded?.();
        }}
      />
      {children ?? label}
    </label>
  );
}

export function UploadedPhotoCount({
  bobbleheadId,
  initialCount,
}: {
  bobbleheadId: string;
  initialCount: number;
}) {
  const { photoUrl } = useUploadedBobbleheadPhoto(bobbleheadId);

  return photoUrl ? Math.max(initialCount, 1) : initialCount;
}
