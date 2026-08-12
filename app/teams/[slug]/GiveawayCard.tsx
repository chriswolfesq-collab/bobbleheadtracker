"use client";

import Link from "next/link";
import { createContext, memo, useContext, useMemo } from "react";
import { BobbleheadImage } from "@/components/BobbleheadImage";
import { resolveTitleParts } from "@/components/BobbleheadTitle";
import { FavoriteButton } from "@/components/FavoriteButton";
import { WantedButton } from "@/components/WantedButton";
import { publicAsset } from "@/lib/paths";
import { isUnoptimizedImage } from "@/lib/imageOptimization";
import type { ListingNavEntry } from "@/lib/listingNav";
import { saveListingTrail } from "@/lib/listingTrail";
import type { Team } from "@/lib/teams";
import type { TeamListing } from "@/lib/teamListings";
import { withTeamView } from "@/lib/teamView";
import { useUserCollection } from "@/lib/userCollections";
import { useUserFavorites } from "@/lib/userFavorites";
import { useUserWanted } from "@/lib/userWanted";

// A listing with everything already applied — admin edits, approved photo, and
// (Athletics only) the Oakland/Sacramento era resolved against the year. One
// definition, in lib/teamListings.ts, because the server and the client each
// assemble this same list and the cards have to take either one.
export type ResolvedGiveaway = TeamListing;

type OwnershipContextValue = {
  ownedCount: number;
  ownedById: Record<string, boolean>;
  // False until the collection has loaded client-side. Until then we can't tell
  // an owned bobblehead from an unowned one, so the card keeps its owned UI
  // neutral rather than flashing an owned item as unowned.
  ownershipKnown: boolean;
  isLoggedIn: boolean;
  toggleOwned: (id: string) => void;
};

const OwnershipContext = createContext<OwnershipContextValue | null>(null);

export function useOwnership() {
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
  const { ownedById, isLoggedIn, isLoading, setOwned } = useUserCollection(teamSlug);
  const ownedCount = Object.values(ownedById).filter(Boolean).length;

  // Memoized so an unrelated re-render (e.g. the collection's filter/sort state
  // changing) doesn't hand every consumer a fresh value object and re-render the
  // whole card grid — only an actual ownership change should.
  const value = useMemo<OwnershipContextValue>(
    () => ({
      ownedCount,
      ownedById,
      ownershipKnown: !isLoading,
      isLoggedIn,
      toggleOwned: (id: string) => setOwned(id, !ownedById[id]),
    }),
    [ownedCount, ownedById, isLoading, isLoggedIn, setOwned],
  );

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

export function useFavorites() {
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

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favoritedById,
      isLoggedIn,
      toggleFavorited: (id: string) => setFavorited(id, !favoritedById[id]),
    }),
    [favoritedById, isLoggedIn, setFavorited],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

type WantedContextValue = {
  wantedById: Record<string, boolean>;
  isLoggedIn: boolean;
  toggleWanted: (id: string) => void;
};

const WantedContext = createContext<WantedContextValue | null>(null);

export function useWanted() {
  const context = useContext(WantedContext);

  if (!context) {
    throw new Error("Wanted components must be used inside WantedProvider.");
  }

  return context;
}

export function WantedProvider({
  children,
  teamSlug,
}: {
  children: React.ReactNode;
  teamSlug: string;
}) {
  const { wantedById, isLoggedIn, setWanted } = useUserWanted(teamSlug);

  const value = useMemo<WantedContextValue>(
    () => ({
      wantedById,
      isLoggedIn,
      toggleWanted: (id: string) => setWanted(id, !wantedById[id]),
    }),
    [wantedById, isLoggedIn, setWanted],
  );

  return <WantedContext.Provider value={value}>{children}</WantedContext.Provider>;
}

// Memoized so re-renders driven by the parent collection's own state (filter
// text, sort order) skip cards whose giveaway/team/eager props are unchanged.
// (A card still re-renders when the ownership/favorites/wanted context it
// consumes changes — that's inherent to context.)
function GiveawayCardInner({
  giveaway,
  team,
  view = "",
  eager = false,
  trailLabel,
  trailEntries,
  trailIndex = 0,
}: {
  giveaway: ResolvedGiveaway;
  team: Team;
  /** the team page's tab/filter/page state, carried into the listing so its
      team crumb leads back to the view this card was clicked from */
  view?: string;
  eager?: boolean;
  /** The filtered/sorted collection this card sits in, recorded on click so the
      listing's prev/next arrows walk it instead of the team's release order.
      Passed as three stable props rather than a ready-made click handler: this
      component is memoized, and a fresh closure per render would defeat that. */
  trailLabel?: string;
  trailEntries?: ListingNavEntry[];
  trailIndex?: number;
}) {
  const { ownedById, ownershipKnown, isLoggedIn, toggleOwned } = useOwnership();
  const { favoritedById, isLoggedIn: isLoggedInForFavorites, toggleFavorited } = useFavorites();
  const { wantedById, isLoggedIn: isLoggedInForWanted, toggleWanted } = useWanted();
  const isOwned = ownedById[giveaway.id] ?? false;
  const isFavorited = favoritedById[giveaway.id] ?? false;
  const isWanted = wantedById[giveaway.id] ?? false;
  const href = withTeamView(
    giveaway.source === "community"
      ? `/teams/${team.slug}/community/${encodeURIComponent(giveaway.id)}`
      : `/teams/${team.slug}/bobbleheads/${giveaway.id}`,
    view,
  );
  const fullTitle = giveaway.title;
  const placeholderSrc = publicAsset(`/bobbleheads/${team.slug}.png`);
  const imageSrc = giveaway.imageUrl ?? placeholderSrc;
  const { primary, secondary } = resolveTitleParts(fullTitle, giveaway.nickname);
  // Player names stay on one line; longer names shrink instead of wrapping.
  const nameSizeClass =
    primary.length > 22
      ? "text-[10px] sm:text-xs"
      : primary.length > 16
        ? "text-[11px] sm:text-sm"
        : "text-xs sm:text-base";

  // Owned and wanted are mutually exclusive: you don't want what's already on
  // your shelf, and something you're still hunting for isn't on it. Whichever
  // you pick clears the other; clearing either one leaves the other alone
  // (un-owning doesn't re-add to wanted, and vice versa).
  const handleToggleOwned = () => {
    if (!isOwned && isWanted) toggleWanted(giveaway.id);
    toggleOwned(giveaway.id);
  };

  const handleToggleWanted = () => {
    if (!isWanted && isOwned) toggleOwned(giveaway.id);
    toggleWanted(giveaway.id);
  };

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border-soft bg-white shadow-sm transition hover:shadow-md">
      <button
        type="button"
        aria-pressed={isOwned}
        disabled={!isLoggedIn || !ownershipKnown}
        aria-label={
          isLoggedIn
            ? `Mark ${fullTitle} as ${isOwned ? "not owned" : "owned"}`
            : `${fullTitle} is ${isOwned ? "owned" : "not owned"} — log in to track`
        }
        title={isLoggedIn ? (isOwned ? "Remove as owned" : "Mark as owned") : "Log in to track"}
        onClick={handleToggleOwned}
        className="absolute left-3 top-3 z-10 grid h-6 w-6 place-items-center rounded border border-zinc-300 bg-white/90 text-xs text-zinc-800 shadow-sm transition hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed enabled:cursor-pointer"
      >
        {isOwned ? (
          <span className="grid h-full w-full place-items-center rounded bg-green-600 font-black text-white">
            ✓
          </span>
        ) : isLoggedIn && !ownershipKnown ? (
          <span aria-hidden className="h-full w-full animate-pulse rounded bg-black/10" />
        ) : null}
      </button>

      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
        <WantedButton
          isWanted={isWanted}
          isLoggedIn={isLoggedInForWanted}
          onToggle={handleToggleWanted}
          itemLabel={fullTitle}
          className="h-6 w-6 text-sm"
        />
        <FavoriteButton
          isFavorited={isFavorited}
          isLoggedIn={isLoggedInForFavorites}
          onToggle={() => toggleFavorited(giveaway.id)}
          itemLabel={fullTitle}
          className="h-6 w-6 text-sm"
        />
      </div>

      <Link
        href={href}
        onClick={
          trailEntries
            ? () => saveListingTrail(trailLabel ?? "", trailEntries, trailIndex)
            : undefined
        }
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="relative flex h-32 items-end justify-center bg-[radial-gradient(circle_at_50%_18%,#ffffff,#f2ead9_78%)] px-3 pt-4 sm:h-52 sm:px-4 sm:pt-6">
          <BobbleheadImage
            src={imageSrc}
            fallbackSrc={placeholderSrc}
            alt={`${fullTitle} bobblehead`}
            width={268}
            height={630}
            eager={eager}
            unoptimized={isUnoptimizedImage(imageSrc)}
            className="relative h-24 w-auto object-contain mix-blend-multiply drop-shadow-[0_10px_12px_rgba(58,36,18,0.35)] sm:h-44"
          />
        </div>
      </Link>

      {/* flex-1 + mt-auto keep the Owned button pinned to the card's bottom
          edge, so neighboring cards stay aligned even when one has an extra
          descriptor line and the other doesn't. */}
      <div className="flex flex-1 flex-col border-t border-border-soft bg-surface px-2.5 pb-2.5 pt-2.5 text-center sm:min-h-36 sm:px-4 sm:pb-3 sm:pt-3">
        <h2
          className={`overflow-hidden whitespace-nowrap font-bold leading-tight text-navy ${nameSizeClass}`}
        >
          {primary}
        </h2>
        {secondary ? (
          <p className="mt-0.5 truncate text-[10px] font-semibold text-zinc-600 sm:text-xs">
            {secondary}
          </p>
        ) : null}
        <p className="mt-1 text-[11px] text-zinc-600 sm:mt-2 sm:text-sm">{giveaway.date}</p>

        <div className="mt-auto pt-2 sm:pt-3">
          <button
            type="button"
            aria-pressed={isOwned}
            disabled={!isLoggedIn || !ownershipKnown}
            className={`w-full rounded px-2 py-2 text-[10px] font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs ${
              isLoggedIn && !ownershipKnown
                ? "border border-border-soft text-zinc-500"
                : isOwned
                  ? "bg-green-600 text-white hover:bg-green-500"
                  : "bg-accent text-accent-fg hover:bg-accent-hover"
            }`}
            onClick={handleToggleOwned}
          >
            {!isLoggedIn
              ? "Log in to track"
              : !ownershipKnown
                ? "…"
                : isOwned
                  ? "✓ I Own It"
                  : "I Own It"}
          </button>
        </div>
      </div>
    </article>
  );
}

export const GiveawayCard = memo(GiveawayCardInner);
