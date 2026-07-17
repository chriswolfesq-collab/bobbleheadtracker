import { revalidateTag } from "next/cache";
import { CURATED_DATA_TAG } from "@/lib/curatedListing";

// Called by the Supabase DB triggers in supabase/revalidate_trigger.sql
// whenever a curated listing's override or approved photo changes — from the
// admin UI or a hand edit in the SQL editor. Busting the shared cache tag
// marks the curated detail pages stale so the next visit re-renders them with
// the new data. Guarded by a shared secret since the route is public.
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret || request.headers.get("x-revalidate-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  revalidateTag(CURATED_DATA_TAG, "max");

  return Response.json({ revalidated: true });
}
