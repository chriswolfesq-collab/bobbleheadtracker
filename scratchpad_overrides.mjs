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
  .from("bobblehead_overrides")
  .select("team_slug, bobblehead_id, title, nickname")
  .eq("team_slug", "padres");

if (error) { console.error("ERROR:", error.message); process.exit(1); }

const quoteChars = ['"', '“', '”', "‘", "’"];
const isQuote = (c) => quoteChars.includes(c);
console.log(`Total padres override rows: ${data.length}\n`);
for (const r of data) {
  const wrapped = r.nickname && r.nickname.trim().length >= 2 && isQuote(r.nickname.trim()[0]) && isQuote(r.nickname.trim().slice(-1));
  console.log(`${wrapped ? "★" : " "} [${r.bobblehead_id}] title=${JSON.stringify(r.title)} nickname=${JSON.stringify(r.nickname)}`);
}
