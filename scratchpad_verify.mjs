import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(Boolean).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)];}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const hasDq = (s) => s && /["“”]/.test(s);
for (const table of ["bobblehead_overrides","community_bobbleheads"]) {
  const { data } = await supabase.from(table).select("*").eq("team_slug","padres");
  const remaining = data.filter(r => hasDq(r.nickname));
  console.log(`${table}: ${data.length} padres rows, ${remaining.length} still have double-quotes in nickname`);
  remaining.forEach(r => console.log(`   ! ${r.bobblehead_id||r.id}: ${JSON.stringify(r.nickname)}`));
}
