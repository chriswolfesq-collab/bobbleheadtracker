// Historically this was a SECOND Supabase client with its own session storage,
// so that admin powers lived behind a separate /admin login and never attached
// to the regular main-site session. That separation has been intentionally
// removed: admin and team-rep powers now ride on the single main-site session
// (whoever is signed in), gated by is_admin() / my_editable_teams() keyed on the
// account's email. A rep or admin who is logged into the site — by password OR
// Google/GitHub — has their powers everywhere, with no second login.
//
// This file remains only as a compatibility alias: many modules import
// `supabaseAdmin` (often as `supabaseAdmin as supabase`). Re-exporting the one
// real client keeps all of them pointing at that single shared session.
export { supabase as supabaseAdmin } from "@/lib/supabase";
