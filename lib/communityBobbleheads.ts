"use client";

import { useEffect, useState } from "react";
import type { Giveaway } from "@/lib/bobbleheads";
import { type RarityTier, parseRarityTier } from "@/lib/rarity";
import { supabase } from "@/lib/supabase";

// `city` is the Athletics-only Oakland/Sacramento pick (lib/athleticsCity.ts),
// and `rarity` is the hand-set badge (lib/rarity.ts). Neither has a place in the
// curated seed data, so they ride on this type rather than on Giveaway itself,
// and both are only read on the detail page — the grid hooks below don't select
// them.
export type CommunityBobblehead = Giveaway & {
  community: true;
  city?: string | null;
  rarity?: RarityTier | null;
  rarityNote?: string | null;
};

export function useCommunityBobbleheads(teamSlug: string) {
  const [communityBobbleheads, setCommunityBobbleheads] = useState<CommunityBobblehead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("community_bobbleheads")
      .select("id, title, nickname, quantity, year, date, image_url, city")
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
              nickname: row.nickname,
              quantity: row.quantity,
              year: row.year,
              date: row.date,
              imageUrl: row.image_url,
              city: row.city,
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

// `createdAt` is when the listing landed in the catalog, which is a different
// thing from `date` (when the bobblehead was handed out at the park). The
// cross-team pages order by it, so they carry it and can show it.
export type CommunityBobbleheadWithTeam = CommunityBobblehead & {
  teamSlug: string;
  createdAt: string;
};

export function useAllCommunityBobbleheads() {
  const [communityBobbleheads, setCommunityBobbleheads] = useState<CommunityBobbleheadWithTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("community_bobbleheads")
      .select("id, team_slug, title, nickname, quantity, year, date, image_url, created_at")
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
              nickname: row.nickname,
              quantity: row.quantity,
              year: row.year,
              date: row.date,
              imageUrl: row.image_url,
              createdAt: row.created_at,
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
      .select("id, team_slug, title, nickname, quantity, year, date, image_url, created_at")
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
              nickname: row.nickname,
              quantity: row.quantity,
              year: row.year,
              date: row.date,
              imageUrl: row.image_url,
              createdAt: row.created_at,
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
      .select("id, title, nickname, quantity, year, date, image_url, city, rarity, rarity_note")
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
            nickname: data.nickname,
            quantity: data.quantity,
            year: data.year,
            date: data.date,
            imageUrl: data.image_url,
            city: data.city,
            rarity: parseRarityTier(data.rarity),
            rarityNote: data.rarity_note,
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
