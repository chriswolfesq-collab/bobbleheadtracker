import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(Boolean).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1)];
  })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data, error } = await supabase
  .from("community_bobbleheads")
  .select("id, title, nickname")
  .eq("team_slug", "padres");

if (error) { console.error("ERROR:", error.message); process.exit(1); }

const quoteChars = ['"', '“', '”', "‘", "’"];
const isQuote = (c) => quoteChars.includes(c);

console.log(`Total padres community rows: ${data.length}\n`);
let affected = 0;
for (const r of data) {
  const n = r.nickname;
  if (!n) continue;
  const t = n.trim();
  const wrapped = t.length >= 2 && isQuote(t[0]) && isQuote(t[t.length - 1]);
  if (wrapped) {
    affected++;
    console.log(`[${r.id}] ${r.title}`);
    console.log(`   nickname: ${JSON.stringify(n)}`);
  }
}
console.log(`\nAffected (wrapped in quotes): ${affected}`);
