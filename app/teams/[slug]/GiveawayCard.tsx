"use client";

import Image from "next/image";
import Link from "next/link";
import { createContext, useContext } from "react";
import { SubmitPhotoButton } from "@/components/SubmitPhotoDialog";
import type { Giveaway } from "@/lib/bobbleheads";
import { publicAsset } from "@/lib/paths";
import type { Team } from "@/lib/teams";
import { useUserCollection } from "@/lib/userCollections";

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

function CardActionButton({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid h-9 w-full place-items-center rounded border border-white/10 bg-white/[0.03] text-zinc-300 transition hover:border-amber-400/50 hover:text-amber-300"
    >
      {children}
    </button>
  );
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
  const isOwned = ownedById[giveaway.id] ?? false;
  const href =
    giveaway.source === "community"
      ? `/teams/${team.slug}/community?id=${encodeURIComponent(giveaway.id)}`
      : `/teams/${team.slug}/bobbleheads/${giveaway.id}`;
  const fullTitle = `${team.name} ${giveaway.title}`;
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

      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
        <div className="flex h-52 items-end justify-center bg-[radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.14),rgba(255,255,255,0)_42%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.22))] px-4 pt-6">
          <Image
            src={imageSrc}
            alt={`${fullTitle} bobblehead`}
            width={268}
            height={630}
            unoptimized={imageSrc.startsWith("http")}
            className="h-44 w-auto object-contain drop-shadow-[0_12px_16px_rgba(0,0,0,0.6)]"
          />
        </div>
      </Link>

      <div className="min-h-40 border-t border-white/[0.04] bg-[#0d1a29]/70 px-4 pb-3 pt-3 text-center">
        <h2 className="text-base font-bold leading-tight text-white">
          {fullTitle}
        </h2>
        <p className="mt-3 text-sm text-zinc-300">{giveaway.date}</p>

        <div className="mt-3 grid grid-cols-2 gap-1">
          <SubmitPhotoButton
            bobbleheadId={giveaway.id}
            teamSlug={team.slug}
            label="▣"
            className="grid h-9 w-full cursor-pointer place-items-center rounded border border-white/10 bg-white/[0.03] text-lg text-zinc-300 transition hover:border-amber-400/50 hover:text-amber-300"
          />
          {isOwned ? (
            <CardActionButton label={`More actions for ${fullTitle}`}>
              <span className="text-xl leading-none">...</span>
            </CardActionButton>
          ) : null}
          <button
            type="button"
            aria-pressed={isOwned}
            disabled={!isLoggedIn}
            className="col-span-2 rounded border border-amber-400 px-2 py-2 text-xs font-bold uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-[#07111d] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => toggleOwned(giveaway.id)}
          >
            {isLoggedIn ? (isOwned ? "Remove as Owned" : "Mark as Owned") : "Log in to track"}
          </button>
        </div>
      </div>

      {index === 0 ? (
        <div className="absolute right-3 top-3 rounded bg-amber-400 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#07111d]">
          New
        </div>
      ) : null}
    </article>
  );
}
