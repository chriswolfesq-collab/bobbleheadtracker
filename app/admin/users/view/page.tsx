import { Suspense } from "react";
import { AdminUserProfile } from "./AdminUserProfile";

// A query-param route (?id=<userId>) rather than a [userId] path segment,
// because the site is a static export (see next.config.ts) and user ids can't
// be enumerated at build time for generateStaticParams. useSearchParams needs
// a Suspense boundary during prerender, same as the community listing page.
export default function AdminUserProfilePage() {
  return (
    <Suspense fallback={<main className="min-h-full bg-[#15110d]" />}>
      <AdminUserProfile />
    </Suspense>
  );
}
