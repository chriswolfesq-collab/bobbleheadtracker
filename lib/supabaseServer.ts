import { createClient } from "@supabase/supabase-js";

// A session-less anon client for server-side reads. Deliberately not the
// module-level singleton from lib/supabase.ts: that one persists a session and
// is shared across every concurrent request on the server, so anything that
// ever wrote a session to it would leak that session between visitors. This
// one holds no session and only ever reads public data under RLS — the same
// pattern lib/publicShelf.ts uses for the shelf pages.
export function createServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
