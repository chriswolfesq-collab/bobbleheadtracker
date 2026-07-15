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
};

export function useMySubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<MySubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    supabase
      .from("submissions")
      .select("id, kind, team_slug, title, status, created_at")
      .eq("submitted_by", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your submissions:", error.message);
          setSubmissions([]);
        } else {
          setSubmissions(
            (data ?? []).map((row) => ({
              id: row.id,
              kind: row.kind,
              teamSlug: row.team_slug,
              title: row.title,
              status: row.status,
              createdAt: row.created_at,
            })),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { submissions: user ? submissions : [], isLoading: user ? isLoading : false };
}
