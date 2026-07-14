"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bobblehead-tracker.uploaded-photos";
const CHANGE_EVENT = "bobblehead-tracker.uploaded-photos-change";

type UploadedPhotos = Record<string, string>;

function readPhotos(): UploadedPhotos {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as UploadedPhotos : {};
  } catch {
    return {};
  }
}

function writePhotos(photos: UploadedPhotos) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read uploaded image."));
      }
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function fileToDataUrl(file: File): Promise<string> {
  if (typeof createImageBitmap === "undefined") {
    return readFileAsDataUrl(file);
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1000;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return readFileAsDataUrl(file);
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return readFileAsDataUrl(file);
  }
}

export function useUploadedBobbleheadPhoto(id: string) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const syncPhoto = () => setPhotoUrl(readPhotos()[id] ?? null);

    syncPhoto();
    window.addEventListener("storage", syncPhoto);
    window.addEventListener(CHANGE_EVENT, syncPhoto);

    return () => {
      window.removeEventListener("storage", syncPhoto);
      window.removeEventListener(CHANGE_EVENT, syncPhoto);
    };
  }, [id]);

  const savePhoto = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please choose an image file.");
    }

    const dataUrl = await fileToDataUrl(file);
    const photos = readPhotos();
    photos[id] = dataUrl;
    writePhotos(photos);
    setPhotoUrl(dataUrl);
  }, [id]);

  const removePhoto = useCallback(() => {
    const photos = readPhotos();
    delete photos[id];
    writePhotos(photos);
    setPhotoUrl(null);
  }, [id]);

  return { photoUrl, savePhoto, removePhoto };
}
