import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES, validatePhotoFile } from "@/lib/uploadValidation";

// What's under test is the friendly pre-check that mirrors the Storage bucket
// caps (supabase/storage_limits.sql). The bucket enforces the real limits; this
// is about the message a person sees, so the cases that matter are the
// boundaries and the formats people actually hit.

function file(name: string, type: string, bytes: number): File {
  // File contents are irrelevant to validation — only size and type are read —
  // so a sized-but-empty buffer keeps the test fast.
  return new File([new ArrayBuffer(bytes)], name, { type });
}

describe("validatePhotoFile", () => {
  it("accepts the formats the site can display", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]) {
      expect(validatePhotoFile(file("photo", type, 1024))).toBeNull();
    }
  });

  it("accepts a file exactly at the size limit", () => {
    expect(validatePhotoFile(file("big.jpg", "image/jpeg", MAX_PHOTO_BYTES))).toBeNull();
  });

  it("rejects a file over the size limit, naming its size", () => {
    const message = validatePhotoFile(file("huge.jpg", "image/jpeg", MAX_PHOTO_BYTES + 1));
    expect(message).toContain("10 MB");
  });

  it("rejects HEIC, the format iPhone pickers let through", () => {
    const message = validatePhotoFile(file("IMG_0001.heic", "image/heic", 1024));
    expect(message).toContain("JPG");
  });

  it("rejects a non-image dressed in an image extension", () => {
    // file.type comes from the browser, which keys off content sniffing or the
    // picker — a .jpg name with a PDF type must still fail.
    expect(validatePhotoFile(file("photo.jpg", "application/pdf", 1024))).not.toBeNull();
  });

  it("checks type before size, so an unsupported oversized file explains the format", () => {
    const message = validatePhotoFile(file("clip.mov", "video/quicktime", MAX_PHOTO_BYTES * 5));
    expect(message).toContain("format");
  });
});
