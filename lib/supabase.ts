import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && typeof window !== "undefined") {
  console.warn(
    "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
);

/** PostgREST's row cap. A select that asks for more comes back trimmed to this,
 *  with no error and nothing else to say it happened. */
export const SUPABASE_PAGE_SIZE = 1000;

// A backstop against a paging bug turning into an endless read, well past any
// table this reads whole.
const MAX_PAGES = 100;

/**
 * Reads a query past PostgREST's row cap, one page at a time, and hands back
 * the lot. `page` gets an inclusive `[from, to]` to pass to `.range()`.
 *
 * Order the query by something unique — a page boundary in an unordered query
 * is free to repeat one row and skip another.
 *
 * Null rather than a short list if a page fails: the caller can't otherwise
 * tell "that's all of them" from "that's what arrived", which is the same trap
 * the row cap sets.
 */
export async function fetchAllPages<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[] | null> {
  const rows: T[] = [];

  for (let index = 0; index < MAX_PAGES; index += 1) {
    const from = index * SUPABASE_PAGE_SIZE;
    const { data, error } = await page(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to read a page:", error.message);
      return null;
    }

    const received = data ?? [];
    rows.push(...received);
    if (received.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows;
}
