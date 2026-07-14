"use client";

import { useCallback, useEffect, useState } from "react";
import type { Giveaway } from "@/lib/bobbleheads";

const STORAGE_KEY = "bobblehead-tracker.custom-bobbleheads";
const CHANGE_EVENT = "bobblehead-tracker.custom-bobbleheads-change";

export type CustomBobblehead = Giveaway & {
  custom: true;
  teamSlug: string;
  createdAt: string;
};

type CustomBobbleheadsByTeam = Record<string, CustomBobblehead[]>;

type NewCustomBobbleheadInput = {
  title: string;
  year: string;
  date: string;
  owned: boolean;
};

function readCustomBobbleheads(): CustomBobbleheadsByTeam {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomBobbleheadsByTeam) : {};
  } catch {
    return {};
  }
}

function writeCustomBobbleheads(customBobbleheads: CustomBobbleheadsByTeam) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customBobbleheads));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function useCustomBobbleheads(teamSlug: string) {
  const [customBobbleheads, setCustomBobbleheads] = useState<CustomBobblehead[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const syncCustomBobbleheads = () => {
      setCustomBobbleheads(readCustomBobbleheads()[teamSlug] ?? []);
      setHasLoaded(true);
    };

    syncCustomBobbleheads();
    window.addEventListener("storage", syncCustomBobbleheads);
    window.addEventListener(CHANGE_EVENT, syncCustomBobbleheads);

    return () => {
      window.removeEventListener("storage", syncCustomBobbleheads);
      window.removeEventListener(CHANGE_EVENT, syncCustomBobbleheads);
    };
  }, [teamSlug]);

  const addCustomBobblehead = useCallback((input: NewCustomBobbleheadInput) => {
    const title = input.title.trim();
    if (!title) return null;

    const existing = readCustomBobbleheads();
    const currentTeamBobbleheads = existing[teamSlug] ?? [];
    const createdAt = new Date().toISOString();
    const customBobblehead: CustomBobblehead = {
      id: `custom-${teamSlug}-${slugify(title) || "bobblehead"}-${Date.now().toString(36)}`,
      title,
      year: input.year.trim() || "Unknown",
      date: input.date.trim() || "N/A",
      owned: input.owned,
      imageUrl: null,
      custom: true,
      teamSlug,
      createdAt,
    };
    const next = {
      ...existing,
      [teamSlug]: [customBobblehead, ...currentTeamBobbleheads],
    };

    writeCustomBobbleheads(next);
    setCustomBobbleheads(next[teamSlug]);

    return customBobblehead;
  }, [teamSlug]);

  return { customBobbleheads, addCustomBobblehead, hasLoaded };
}

export function useCustomBobblehead(teamSlug: string, bobbleheadId: string) {
  const { customBobbleheads, hasLoaded } = useCustomBobbleheads(teamSlug);

  return {
    customBobblehead: customBobbleheads.find((bobblehead) => bobblehead.id === bobbleheadId) ?? null,
    hasLoaded,
  };
}
