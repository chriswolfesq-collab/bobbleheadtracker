import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(Boolean).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)];}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data } = await supabase.from("community_bobbleheads").select("id, title, nickname").eq("team_slug","padres");
for (const r of data) {
  console.log(`${r.id} | ${r.title}`);
  console.log(`   nickname=${JSON.stringify(r.nickname)}  codepoints=[${[...(r.nickname||"")].map(c=>c.codePointAt(0).toString(16)).join(",")}]`);
}
