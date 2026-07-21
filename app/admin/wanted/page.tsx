"use client";

import { AdminItemsBrowser } from "@/components/AdminItemsBrowser";
import { useAdminUserItems } from "@/lib/adminCollections";

export default function AdminWantedPage() {
  const { items, isLoading, error } = useAdminUserItems("wanted");

  return (
    <AdminItemsBrowser
      title="Wanted items"
      description="Every bobblehead on a collector's wanted list."
      items={items}
      isLoading={isLoading}
      error={error}
      noun="wanted items"
    />
  );
}
