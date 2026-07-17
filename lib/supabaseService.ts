import { createClient } from "@supabase/supabase-js";

// A client authenticated with the service-role key, so it bypasses RLS. Used
// exclusively by the nightly dead-image sweep (app/api/dead-image-sweep) to read
// every image source and write the dead_images queue — a job with no signed-in
// user, so the anon+is_admin() path the admin UI uses doesn't apply.
//
// The service-role key must never reach the browser: this module is imported
// only from the sweep route handler (server-side), and the key is read from a
// non-NEXT_PUBLIC_ env var so it can't be inlined into a client bundle. Session
// persistence is off for the same reason as lib/supabaseServer.ts.
export function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — the dead-image sweep needs both set in the server environment.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
