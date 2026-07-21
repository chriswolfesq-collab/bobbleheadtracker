"use client";

import { AdminItemsBrowser } from "@/components/AdminItemsBrowser";
import { useAdminUserItems } from "@/lib/adminCollections";

export default function AdminFavoritedPage() {
  const { items, isLoading, error } = useAdminUserItems("favorited");

  return (
    <AdminItemsBrowser
      title="Favorited items"
      description="Every bobblehead a collector has favorited."
      items={items}
      isLoading={isLoading}
      error={error}
      noun="favorited items"
    />
  );
}
