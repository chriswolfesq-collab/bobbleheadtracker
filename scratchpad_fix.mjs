import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(Boolean).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1)];
  })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const APPLY = process.argv.includes("--apply");

// Remove ONLY double-quotation marks: straight ", curly “ ”. Leave single
// quotes/apostrophes ('98, Collector's) and all other text intact.
function fix(s) {
  if (s == null) return s;
  const cleaned = s.replace(/["“”]/g, "").replace(/\s{2,}/g, " ").trim();
  return cleaned || null;
}

async function processTable(table, idCols) {
  const { data, error } = await supabase.from(table).select(`${idCols.join(", ")}, nickname`).eq("team_slug", "padres");
  if (error) { console.error(`${table} READ ERROR:`, error.message); return; }
  const changes = [];
  for (const r of data) {
    const next = fix(r.nickname);
    if (next !== r.nickname) changes.push({ r, next });
  }
  console.log(`\n=== ${table}: ${changes.length} of ${data.length} rows need fixing ===`);
  for (const { r, next } of changes) {
    const key = idCols.map((c) => r[c]).join("/");
    console.log(`  ${key}`);
    console.log(`    - ${JSON.stringify(r.nickname)}`);
    console.log(`    + ${JSON.stringify(next)}`);
  }
  if (APPLY) {
    for (const { r, next } of changes) {
      let q = supabase.from(table).update({ nickname: next });
      for (const c of idCols) q = q.eq(c, r[c]);
      const { error: uErr } = await q;
      if (uErr) console.error(`    UPDATE FAILED ${idCols.map((c)=>r[c]).join("/")}: ${uErr.message}`);
    }
    console.log(`  -> applied ${changes.length} updates to ${table}`);
  }
  return changes.length;
}

await processTable("bobblehead_overrides", ["team_slug", "bobblehead_id"]);
await processTable("community_bobbleheads", ["id"]);
console.log(APPLY ? "\nDONE (applied)" : "\nDRY RUN — re-run with --apply to write");
