import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// A second client with its own session storage key, so admin-mode login (at
// /admin) never shares or overwrites the regular site's session — even when
// the same email/password is used for both. Two independent sessions can
// coexist in the same browser this way: logging in as a regular fan on the
// main site never grants admin powers, and logging into admin mode never
// affects your regular collection/login state.
export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      storageKey: "bobbleshelf-admin-auth",
    },
  },
);
