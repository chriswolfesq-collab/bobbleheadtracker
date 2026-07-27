import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(Boolean).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)];}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
// Try updating one row and ask Postgres to return the affected rows.
const { data, error, status, count } = await supabase
  .from("bobblehead_overrides")
  .update({ nickname: "No Hitter" })
  .eq("team_slug","padres").eq("bobblehead_id","dylan-cease-2025")
  .select();
console.log("status:", status, "| error:", error?.message ?? "none", "| rows returned:", (data??[]).length, JSON.stringify(data));
