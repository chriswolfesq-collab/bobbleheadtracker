"use client";

import { useEffect, useState } from "react";
import type { Giveaway } from "@/lib/bobbleheads";
import { supabase } from "@/lib/supabase";

export type CommunityBobblehead = Giveaway & { community: true };

export function useCommunityBobbleheads(teamSlug: string) {
  const [communityBobbleheads, setCommunityBobbleheads] = useState<CommunityBobblehead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("community_bobbleheads")
      .select("id, title, year, date, image_url")
      .eq("team_slug", teamSlug)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load community bobbleheads:", error.message);
          setCommunityBobbleheads([]);
        } else {
          setCommunityBobbleheads(
            (data ?? []).map((row) => ({
              id: row.id,
              title: row.title,
              year: row.year,
              date: row.date,
              imageUrl: row.image_url,
              community: true as const,
            })),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamSlug]);

  return { communityBobbleheads, isLoading };
}

export type CommunityBobbleheadWithTeam = CommunityBobblehead & { teamSlug: string };

export function useAllCommunityBobbleheads() {
  const [communityBobbleheads, setCommunityBobbleheads] = useState<CommunityBobbleheadWithTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("community_bobbleheads")
      .select("id, team_slug, title, year, date, image_url")
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load community bobbleheads:", error.message);
          setCommunityBobbleheads([]);
        } else {
          setCommunityBobbleheads(
            (data ?? []).map((row) => ({
              id: row.id,
              teamSlug: row.team_slug,
              title: row.title,
              year: row.year,
              date: row.date,
              imageUrl: row.image_url,
              community: true as const,
            })),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { communityBobbleheads, isLoading };
}

export function useRecentCommunityBobbleheads(limit: number) {
  const [communityBobbleheads, setCommunityBobbleheads] = useState<CommunityBobbleheadWithTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("community_bobbleheads")
      .select("id, team_slug, title, year, date, image_url")
      .order("created_at", { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load recent community bobbleheads:", error.message);
          setCommunityBobbleheads([]);
        } else {
          setCommunityBobbleheads(
            (data ?? []).map((row) => ({
              id: row.id,
              teamSlug: row.team_slug,
              title: row.title,
              year: row.year,
              date: row.date,
              imageUrl: row.image_url,
              community: true as const,
            })),
          );
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { communityBobbleheads, isLoading };
}

export function useCommunityBobblehead(teamSlug: string, bobbleheadId: string) {
  const [communityBobblehead, setCommunityBobblehead] = useState<CommunityBobblehead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("community_bobbleheads")
      .select("id, title, year, date, image_url")
      .eq("team_slug", teamSlug)
      .eq("id", bobbleheadId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error || !data) {
          if (error) console.error("Failed to load bobblehead:", error.message);
          setCommunityBobblehead(null);
          setNotFound(true);
        } else {
          setCommunityBobblehead({
            id: data.id,
            title: data.title,
            year: data.year,
            date: data.date,
            imageUrl: data.image_url,
            community: true,
          });
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamSlug, bobbleheadId]);

  return { communityBobblehead, isLoading, notFound };
}
