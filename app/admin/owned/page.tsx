"use client";

import { AdminItemsBrowser } from "@/components/AdminItemsBrowser";
import { useAdminUserItems } from "@/lib/adminCollections";

export default function AdminOwnedPage() {
  const { items, isLoading, error } = useAdminUserItems("owned");

  return (
    <AdminItemsBrowser
      title="Owned items"
      description="Every bobblehead marked owned across all collectors."
      items={items}
      isLoading={isLoading}
      error={error}
      noun="owned items"
    />
  );
}
