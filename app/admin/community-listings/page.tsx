"use client";

import { AdminItemsBrowser } from "@/components/AdminItemsBrowser";
import { useAdminCommunityListings } from "@/lib/adminCollections";

export default function AdminCommunityListingsPage() {
  const { items, isLoading, error } = useAdminCommunityListings();

  return (
    <AdminItemsBrowser
      title="Community listings"
      description="Every community-submitted bobblehead across all teams, newest first."
      items={items}
      isLoading={isLoading}
      error={error}
      noun="community listings"
    />
  );
}
