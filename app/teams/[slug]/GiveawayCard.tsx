"use client";

import Image from "next/image";
import Link from "next/link";
import { createContext, useContext } from "react";
import { FavoriteButton } from "@/components/FavoriteButton";
import type { Giveaway } from "@/lib/bobbleheads";
import { publicAsset } from "@/lib/paths";
import type { Team } from "@/lib/teams";
import { useUserCollection } from "@/lib/userCollections";
import { useUserFavorites } from "@/lib/userFavorites";

export type ResolvedGiveaway = Giveaway & { source: "curated" | "community" };

type OwnershipContextValue = {
  ownedCount: number;
  ownedById: Record<string, boolean>;
  isLoggedIn: boolean;
  toggleOwned: (id: string) => void;
};

const OwnershipContext = createContext<OwnershipContextValue | null>(null);

function useOwnership() {
  const context = useContext(OwnershipContext);

  if (!context) {
    throw new Error("Ownership components must be used inside OwnershipProvider.");
  }

  return context;
}

export function OwnershipProvider({
  children,
  teamSlug,
}: {
  children: React.ReactNode;
  teamSlug: string;
}) {
  const { ownedById, isLoggedIn, setOwned } = useUserCollection(teamSlug);
  const ownedCount = Object.values(ownedById).filter(Boolean).length;

  const value: OwnershipContextValue = {
    ownedCount,
    ownedById,
    isLoggedIn,
    toggleOwned: (id: string) => setOwned(id, !ownedById[id]),
  };

  return <OwnershipContext.Provider value={value}>{children}</OwnershipContext.Provider>;
}

export function OwnedCount() {
  const { ownedCount } = useOwnership();

  return ownedCount;
}

type FavoritesContextValue = {
  favoritedById: Record<string, boolean>;
  isLoggedIn: boolean;
  toggleFavorited: (id: string) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function useFavorites() {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error("Favorites components must be used inside FavoritesProvider.");
  }

  return context;
}

export function FavoritesProvider({
  children,
  teamSlug,
}: {
  children: React.ReactNode;
  teamSlug: string;
}) {
  const { favoritedById, isLoggedIn, setFavorited } = useUserFavorites(teamSlug);

  const value: FavoritesContextValue = {
    favoritedById,
    isLoggedIn,
    toggleFavorited: (id: string) => setFavorited(id, !favoritedById[id]),
  };

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function GiveawayCard({
  giveaway,
  team,
  index,
}: {
  giveaway: ResolvedGiveaway;
  team: Team;
  index: number;
}) {
  const { ownedById, isLoggedIn, toggleOwned } = useOwnership();
  const { favoritedById, isLoggedIn: isLoggedInForFavorites, toggleFavorited } = useFavorites();
  const isOwned = ownedById[giveaway.id] ?? false;
  const isFavorited = favoritedById[giveaway.id] ?? false;
  const href =
    giveaway.source === "community"
      ? `/teams/${team.slug}/community?id=${encodeURIComponent(giveaway.id)}`
      : `/teams/${team.slug}/bobbleheads/${giveaway.id}`;
  const fullTitle = giveaway.title;
  const imageSrc = giveaway.imageUrl ?? publicAsset(`/bobbleheads/${team.slug}.png`);

  return (
    <article className="relative overflow-hidden rounded-lg border border-white/10 bg-[#102032] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div
        aria-label={`${fullTitle} is ${isOwned ? "owned" : "not owned"}`}
        className="absolute left-3 top-3 z-10 grid h-6 w-6 place-items-center rounded border border-zinc-300/80 bg-[#0a1522]/80 text-xs text-zinc-200"
        role="img"
      >
        {isOwned ? (
          <span className="grid h-full w-full place-items-center rounded bg-green-500 font-black text-[#06110a]">
            ✓
          </span>
        ) : null}
      </div>

      <FavoriteButton
        isFavorited={isFavorited}
        isLoggedIn={isLoggedInForFavorites}
        onToggle={() => toggleFavorited(giveaway.id)}
        className="absolute right-3 top-3 z-10 h-6 w-6 text-sm"
      />

      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
        <div className="flex h-32 items-end justify-center bg-[radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.14),rgba(255,255,255,0)_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.22))] px-3 pt-4 sm:h-52 sm:px-4 sm:pt-6">
          <Image
            src={imageSrc}
            alt={`${fullTitle} bobblehead`}
            width={268}
            height={630}
            unoptimized={imageSrc.startsWith("http")}
            className="h-24 w-auto object-contain drop-shadow-[0_12px_16px_rgba(0,0,0,0.6)] sm:h-44"
          />
        </div>
      </Link>

      <div className="border-t border-white/[0.04] bg-[#0d1a29]/70 px-2.5 pb-2.5 pt-2.5 text-center sm:min-h-40 sm:px-4 sm:pb-3 sm:pt-3">
        <h2 className="text-xs font-bold leading-tight text-white sm:text-base">
          {fullTitle}
        </h2>
        <p className="mt-1.5 text-[11px] text-zinc-300 sm:mt-3 sm:text-sm">{giveaway.date}</p>

        <div className="mt-2 sm:mt-3">
          <button
            type="button"
            aria-pressed={isOwned}
            disabled={!isLoggedIn}
            className="w-full rounded border border-amber-400 px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-[#07111d] disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
            onClick={() => toggleOwned(giveaway.id)}
          >
            {isLoggedIn ? (isOwned ? "Remove as Owned" : "Mark as Owned") : "Log in to track"}
          </button>
        </div>
      </div>

      {index === 0 ? (
        <div className="absolute right-3 top-11 rounded bg-amber-400 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#07111d]">
          New
        </div>
      ) : null}
    </article>
  );
}
