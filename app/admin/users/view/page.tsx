import { Suspense } from "react";
import { AdminUserProfile } from "./AdminUserProfile";

// A query-param route (?id=<userId>) rather than a [userId] path segment. This
// dates from the static-export era, when user ids couldn't be enumerated at
// build time for generateStaticParams; the site is server-rendered now, so a
// path segment would work, but the shape is kept because admin URLs aren't
// worth a migration. useSearchParams needs a Suspense boundary during
// prerender, same as the community listing page.
export default function AdminUserProfilePage() {
  return (
    <Suspense fallback={<main className="min-h-full bg-slate-50 dark:bg-[#15110d]" />}>
      <AdminUserProfile />
    </Suspense>
  );
}
