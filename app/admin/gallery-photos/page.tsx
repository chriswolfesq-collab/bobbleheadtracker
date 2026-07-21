"use client";

import { AdminItemsBrowser } from "@/components/AdminItemsBrowser";
import { useAdminGalleryPhotos } from "@/lib/adminCollections";

export default function AdminGalleryPhotosPage() {
  const { items, isLoading, error } = useAdminGalleryPhotos();

  return (
    <AdminItemsBrowser
      title="Gallery photos"
      description="Every fan-uploaded gallery photo across all listings, newest first."
      items={items}
      isLoading={isLoading}
      error={error}
      noun="gallery photos"
      variant="photo"
    />
  );
}
