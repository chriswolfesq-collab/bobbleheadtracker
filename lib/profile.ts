"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import { supabase } from "@/lib/supabase";
import { TEAMS } from "@/lib/teams";

export type TeamCount = { teamSlug: string; count: number };

// The site total per team is the curated giveaway list (static) plus any
// community-submitted bobbleheads that have been approved for that team.
export function useSiteBobbleheadCounts() {
  const [communityCountByTeamSlug, setCommunityCountByTeamSlug] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("community_bobbleheads")
      .select("team_slug")
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load community bobblehead counts:", error.message);
          setCommunityCountByTeamSlug({});
        } else {
          const counts: Record<string, number> = {};
          for (const row of data ?? []) {
            counts[row.team_slug] = (counts[row.team_slug] ?? 0) + 1;
          }
          setCommunityCountByTeamSlug(counts);
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const totalByTeamSlug: Record<string, number> = {};
  for (const team of TEAMS) {
    totalByTeamSlug[team.slug] =
      getGiveawaysByTeamSlug(team.slug).length + (communityCountByTeamSlug[team.slug] ?? 0);
  }
  const siteTotal = Object.values(totalByTeamSlug).reduce((sum, count) => sum + count, 0);

  return { totalByTeamSlug, siteTotal, isLoading };
}

export function useCollectionSummary() {
  const { user } = useAuth();
  const [countByTeamSlug, setCountByTeamSlug] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    supabase
      .from("user_collections")
      .select("team_slug, owned")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your collection summary:", error.message);
          setCountByTeamSlug({});
        } else {
          const counts: Record<string, number> = {};
          for (const row of data ?? []) {
            if (!row.owned) continue;
            counts[row.team_slug] = (counts[row.team_slug] ?? 0) + 1;
          }
          setCountByTeamSlug(counts);
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const resolvedCounts = user ? countByTeamSlug : {};
  const totalOwned = Object.values(resolvedCounts).reduce((sum, count) => sum + count, 0);

  return { countByTeamSlug: resolvedCounts, totalOwned, isLoading: user ? isLoading : false };
}

export type MySubmission = {
  id: string;
  kind: "photo_for_existing" | "new_bobblehead";
  teamSlug: string;
  title: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  imageUrl: string | null;
  href: string | null;
};

// Pending/rejected photos still live in the private bobblehead-pending bucket
// (readable by their owner via RLS), while approved photos were copied to the
// public bobblehead-approved bucket under `${submissionId}-${filename}` (see
// moveToApproved in app/admin/review/page.tsx) — so the URL has to be derived
// differently depending on status.
async function resolveSubmissionImageUrl(
  status: MySubmission["status"],
  submissionId: string,
  storagePath: string,
): Promise<string | null> {
  if (status === "approved") {
    const filename = storagePath.split("/").pop() ?? "photo";
    const { data } = supabase.storage
      .from("bobblehead-approved")
      .getPublicUrl(`${submissionId}-${filename}`);
    return data.publicUrl ?? null;
  }

  const { data } = await supabase.storage
    .from("bobblehead-pending")
    .createSignedUrl(storagePath, 60 * 10);
  return data?.signedUrl ?? null;
}

// A submission only becomes a real listing once it's approved. photo_for_existing
// points at either a curated bobblehead (static list) or a community one; new_bobblehead
// becomes a community_bobbleheads row whose generated id ends in the submission's
// first 8 chars (see approve_submission() in supabase/schema.sql), so we look it up that way.
async function resolveSubmissionHref(
  status: MySubmission["status"],
  kind: MySubmission["kind"],
  submissionId: string,
  teamSlug: string,
  targetBobbleheadId: string | null,
): Promise<string | null> {
  if (status !== "approved") return null;

  if (kind === "photo_for_existing") {
    if (!targetBobbleheadId) return null;
    const isCurated = getGiveawaysByTeamSlug(teamSlug).some((g) => g.id === targetBobbleheadId);
    return isCurated
      ? `/teams/${teamSlug}/bobbleheads/${targetBobbleheadId}`
      : `/teams/${teamSlug}/community?id=${encodeURIComponent(targetBobbleheadId)}`;
  }

  const { data } = await supabase
    .from("community_bobbleheads")
    .select("id")
    .eq("team_slug", teamSlug)
    .like("id", `%-${submissionId.slice(0, 8)}`)
    .maybeSingle();

  return data ? `/teams/${teamSlug}/community?id=${encodeURIComponent(data.id)}` : null;
}

export function useMySubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<MySubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    supabase
      .from("submissions")
      .select("id, kind, team_slug, title, status, created_at, storage_path, target_bobblehead_id")
      .eq("submitted_by", user.id)
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your submissions:", error.message);
          setSubmissions([]);
          setIsLoading(false);
          return;
        }

        const withDetails = await Promise.all(
          (data ?? []).map(async (row) => ({
            id: row.id,
            kind: row.kind,
            teamSlug: row.team_slug,
            title: row.title,
            status: row.status,
            createdAt: row.created_at,
            imageUrl: await resolveSubmissionImageUrl(row.status, row.id, row.storage_path),
            href: await resolveSubmissionHref(
              row.status,
              row.kind,
              row.id,
              row.team_slug,
              row.target_bobblehead_id,
            ),
          })),
        );

        if (cancelled) return;

        setSubmissions(withDetails);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { submissions: user ? submissions : [], isLoading: user ? isLoading : false };
}
