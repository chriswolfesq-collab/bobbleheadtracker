import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(Boolean).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)];}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data } = await supabase.from("bobblehead_overrides").select("bobblehead_id, nickname").eq("team_slug","padres").eq("bobblehead_id","tony-gwynn-2025").maybeSingle();
console.log(JSON.stringify(data));
