import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(Boolean).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)];}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
function fix(s){ if(s==null) return s; const c=s.replace(/["“”]/g,"").replace(/\s{2,}/g," ").trim(); return c||null; }
const out = { overrides: [], community: [] };
for (const [table,key,arr] of [["bobblehead_overrides","bobblehead_id","overrides"],["community_bobbleheads","id","community"]]) {
  const { data } = await supabase.from(table).select("*").eq("team_slug","padres");
  for (const r of data) { const n=fix(r.nickname); if(n!==r.nickname) out[arr].push({id:r[key], from:r.nickname, to:n}); }
}
console.log(JSON.stringify(out,null,1));
console.log(`\nTOTAL to fix: overrides=${out.overrides.length} community=${out.community.length}`);
