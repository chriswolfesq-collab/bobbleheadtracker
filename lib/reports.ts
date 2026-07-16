"use client";

import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type ReportReason = "not_real" | "wrong_date" | "wrong_name" | "duplicate" | "other";

export async function submitListingReport({
  user,
  teamSlug,
  bobbleheadId,
  source,
  title,
  reason,
  details,
}: {
  user: User;
  teamSlug: string;
  bobbleheadId: string;
  source: "curated" | "community";
  title: string;
  reason: ReportReason;
  details: string;
}) {
  const { error } = await supabase.from("listing_reports").insert({
    team_slug: teamSlug,
    bobblehead_id: bobbleheadId,
    source,
    title,
    reason,
    details: details || null,
    submitted_by: user.id,
  });

  if (error) {
    throw new Error(error.message);
  }
}
