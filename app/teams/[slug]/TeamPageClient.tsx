"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { useApprovedPhotos } from "@/lib/approvedPhotos";
import { useAuth } from "@/lib/auth";
import type { Giveaway } from "@/lib/bobbleheads";
import { useBobbleheadOverrides, type BobbleheadOverridesLookup } from "@/lib/bobbleheadOverrides";
import { useCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { findDuplicateBobblehead, type DuplicateCandidate } from "@/lib/duplicateCheck";
import { publicAsset } from "@/lib/paths";
import { submitNewBobblehead } from "@/lib/submissions";
import type { Team } from "@/lib/teams";
import { BobbleheadCollection } from "./BobbleheadCollection";
import { FavoritesProvider, OwnershipProvider, WantedProvider, useOwnership, type ResolvedGiveaway } from "./GiveawayCard";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// The calendar picker gives us an ISO date ("2026-07-14"); store it in the same
// human-readable format as the rest of the catalog ("July 14, 2026"). Parse the
// parts directly to avoid timezone-shifted Date() off-by-one errors.
function formatSubmissionDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    return "N/A";
  }
  const [, year, month, day] = match;
  return `${MONTH_NAMES[Number(month) - 1]} ${Number(day)}, ${year}`;
}

// Release-date bounds for the submission form: the first MLB bobblehead
// giveaways date to the late 1990s; allow a little future for announced promos.
const MIN_RELEASE_DATE = "1960-01-01";
const MAX_RELEASE_DATE = `${new Date().getFullYear() + 2}-12-31`;

function SubmitBobbleheadForm({
  teamSlug,
  communityBobbleheads,
  isDeleted,
  onDone,
}: {
  teamSlug: string;
  communityBobbleheads: DuplicateCandidate[];
  isDeleted: BobbleheadOverridesLookup["isDeleted"];
  onDone: (result: { autoApproved: boolean; autoApproveError?: string }) => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [nickname, setNickname] = useState("");
  const [quantity, setQuantity] = useState("");
  const [quantityUnknown, setQuantityUnknown] = useState(false);
  const [date, setDate] = useState("");
  const [dateUnknown, setDateUnknown] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateCandidate | null>(null);

  if (!user) {
    return (
      <div className="mb-5 rounded-lg border border-accent/35 bg-accent/10 p-4 text-sm text-foreground">
        Log in to submit a bobblehead for review.
      </div>
    );
  }

  return (
    <form
      className="mb-5 grid gap-3 rounded-lg border border-accent/35 bg-accent/10 p-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
      onSubmit={async (event) => {
        event.preventDefault();

        if (!duplicateMatch) {
          const match = findDuplicateBobblehead(teamSlug, title, nickname, communityBobbleheads, isDeleted);
          if (match) {
            setDuplicateMatch(match);
            return;
          }
        }

        setIsSubmitting(true);
        setError(null);

        try {
          const result = await submitNewBobblehead({
            user,
            teamSlug,
            title,
            nickname,
            quantity: quantityUnknown ? "Unknown" : quantity,
            date: dateUnknown ? "N/A" : formatSubmissionDate(date),
            file,
          });
          onDone(result);
        } catch (submitError) {
          setError(submitError instanceof Error ? submitError.message : "Could not submit bobblehead.");
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <p className="text-xs font-semibold leading-5 text-accent sm:col-span-6">
        MLB stadium giveaway (SGA) bobbleheads only — no figurines, ring or trophy replicas, stadium
        replicas, gnomes, or other non-bobblehead promos.
      </p>
      <label className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-accent">Player Name</span>
        <input
          required
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setDuplicateMatch(null);
          }}
          placeholder="Fernando Valenzuela"
          className="mt-1 w-full rounded border border-border-soft bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent"
        />
      </label>
      <label className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-accent">Edition / Variant</span>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="“El Toro”, City Connect… (optional)"
          className="mt-1 w-full rounded border border-border-soft bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent"
        />
        <span className="mt-1 block text-[11px] leading-4 text-zinc-600">
          Nickname, variant, or short descriptor that identifies this bobblehead.
        </span>
      </label>
      <label className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-accent">Quantity Issued</span>
        <input
          value={quantity}
          disabled={quantityUnknown}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="25,000 (optional)"
          className="mt-1 w-full rounded border border-border-soft bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent disabled:opacity-50"
        />
        <span className="mt-1.5 flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={quantityUnknown}
            onChange={(event) => setQuantityUnknown(event.target.checked)}
            className="h-3.5 w-3.5 accent-accent"
          />
          <span className="text-xs font-semibold text-zinc-700">
            Quantity Unknown
          </span>
        </span>
      </label>
      <label className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-accent">Date</span>
        <input
          type="date"
          value={date}
          disabled={dateUnknown}
          min={MIN_RELEASE_DATE}
          max={MAX_RELEASE_DATE}
          onChange={(event) => {
            setDate(event.target.value);
            setDuplicateMatch(null);
          }}
          className="mt-1 w-full rounded border border-border-soft bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none transition [color-scheme:light] focus:border-accent disabled:opacity-50"
        />
        <span className="mt-1.5 flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={dateUnknown}
            onChange={(event) => {
              setDateUnknown(event.target.checked);
              setDuplicateMatch(null);
            }}
            className="h-3.5 w-3.5 accent-accent"
          />
          <span className="text-xs font-semibold text-zinc-700">
            Date Unknown
          </span>
        </span>
      </label>
      <label className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-accent">Photo (optional)</span>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="mt-1 w-full text-xs text-zinc-800 file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1.5 file:text-xs file:font-black file:uppercase file:text-accent-fg"
        />
      </label>
      <div className="flex items-end gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-10 rounded bg-accent px-4 text-sm font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
        >
          {isSubmitting ? "Submitting…" : duplicateMatch ? "Submit anyway" : "Submit"}
        </button>
      </div>
      {duplicateMatch ? (
        <p className="text-xs font-semibold text-accent sm:col-span-6">
          This looks like it might already be on the shelf: “{duplicateMatch.title}” ({duplicateMatch.date}).
          Click submit again to add it anyway.
        </p>
      ) : null}
      {error ? <p className="text-xs font-semibold text-red-500 sm:col-span-6">{error}</p> : null}
      <p className="text-xs leading-5 text-zinc-700 sm:col-span-6">
        Submitted bobbleheads are reviewed by the site admin before they appear for everyone.
      </p>
    </form>
  );
}

// The stats bar that overlaps the hero: Total / Owned / Needed / Completion.
// Owned-dependent numbers stay as an em dash until ownership is known so an
// owned collection never flashes "Needed = everything" while loading; see the
// ownershipKnown notes in GiveawayCard.tsx.
function StatsBar({ total }: { total: number }) {
  const { ownedCount, ownershipKnown, isLoggedIn } = useOwnership();
  const ready = isLoggedIn && ownershipKnown;
  const owned = ready ? ownedCount : null;
  const needed = ready ? Math.max(0, total - ownedCount) : null;
  const percent = ready && total > 0 ? (ownedCount / total) * 100 : null;

  return (
    <div className="relative z-10 mx-auto -mt-12 w-full max-w-4xl px-4 sm:px-6">
      <div className="grid grid-cols-2 items-center gap-4 rounded-xl border border-border-soft bg-surface px-6 py-5 shadow-lg sm:grid-cols-4">
      <div className="text-center">
        <p className="font-display text-3xl font-bold text-navy">{total}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Total Bobbleheads
        </p>
      </div>
      <div className="text-center">
        <p className="font-display text-3xl font-bold text-navy">{owned ?? "—"}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Owned</p>
      </div>
      <div className="text-center">
        <p className="font-display text-3xl font-bold text-navy">{needed ?? "—"}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Needed</p>
      </div>
      <div className="flex flex-col items-center gap-1">
        <ProgressRing percent={percent} />
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {isLoggedIn ? "Completion" : "Sign in to track"}
        </p>
      </div>
      </div>
    </div>
  );
}

export function TeamPageClient({
  giveaways,
  team,
}: {
  giveaways: Giveaway[];
  team: Team;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [justApproved, setJustApproved] = useState(false);
  const [autoApproveError, setAutoApproveError] = useState<string | null>(null);
  const { communityBobbleheads } = useCommunityBobbleheads(team.slug);
  const { photoUrlById } = useApprovedPhotos(team.slug);
  const { isDeleted, getOverride } = useBobbleheadOverrides();

  const allGiveaways = useMemo<ResolvedGiveaway[]>(() => {
    const curated: ResolvedGiveaway[] = giveaways
      .filter((giveaway) => !isDeleted(team.slug, giveaway.id))
      .map((giveaway) => {
        const override = getOverride(team.slug, giveaway.id);
        return {
          ...giveaway,
          title: override?.title ?? giveaway.title,
          nickname: override?.nickname ?? giveaway.nickname ?? null,
          year: override?.year ?? giveaway.year,
          date: override?.date ?? giveaway.date,
          // A removed seed photo leaves nothing behind, so the card falls back
          // to the team placeholder — same as a listing that never had one.
          imageUrl: photoUrlById[giveaway.id] ?? (override?.photoHidden ? undefined : giveaway.imageUrl),
          source: "curated",
        };
      });
    const community: ResolvedGiveaway[] = communityBobbleheads.map((giveaway) => ({
      ...giveaway,
      imageUrl: photoUrlById[giveaway.id] ?? giveaway.imageUrl,
      source: "community",
    }));

    return [...curated, ...community];
  }, [giveaways, communityBobbleheads, photoUrlById, isDeleted, getOverride, team.slug]);

  return (
    <OwnershipProvider teamSlug={team.slug}>
      <FavoritesProvider teamSlug={team.slug}>
        <WantedProvider teamSlug={team.slug}>
          <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
            {/* Hero: team-color gradient with a slot for a future skyline image */}
            <section
              className="relative overflow-hidden pb-20 pt-6"
              style={{
                background: `radial-gradient(circle at 78% 10%, ${team.primary}55, transparent 42%), linear-gradient(160deg, ${team.primary} 0%, ${team.primary}cc 55%, var(--navy-deep) 100%)`,
              }}
            >
              {/* Future skyline photo drops in here, behind the gradient text:
                  <Image src={`/skylines/${team.slug}.jpg`} alt="" fill
                    className="object-cover opacity-40 mix-blend-luminosity" /> */}
              <div data-hero-image-slot className="absolute inset-0" />

              <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <Link
                    href="/teams"
                    className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white/85 transition hover:text-white"
                  >
                    <span aria-hidden>←</span> All teams
                  </Link>
                </div>

                <div className="mt-4 flex items-start justify-between font-display text-lg font-bold uppercase tracking-[0.2em] text-brass-light sm:text-xl">
                  <span>Est. {team.established}</span>
                  <span>
                    {team.league} {team.division}
                  </span>
                </div>

                <div className="mt-2 pb-2 text-center">
                  <p className="font-script text-3xl text-white/90 sm:text-4xl">{team.city}</p>
                  <div className="mt-1 flex items-center justify-center gap-5">
                    <Image
                      src={publicAsset(`/bobbleheads/${team.slug}.png`)}
                      alt={`${team.city} ${team.name} bobblehead`}
                      width={135}
                      height={321}
                      priority
                      className="hidden h-28 w-auto drop-shadow-[0_12px_16px_rgba(0,0,0,0.55)] sm:block"
                    />
                    <h1 className="font-display text-6xl font-bold uppercase leading-none tracking-wide text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)] sm:text-8xl">
                      {team.name}
                    </h1>
                  </div>
                </div>
              </div>
            </section>

            <StatsBar total={allGiveaways.length} />

            <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-navy">
                  SGA Bobbleheads
                </h2>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 self-start rounded border border-accent px-4 py-2 text-sm font-black uppercase tracking-wide text-accent transition hover:bg-accent hover:text-accent-fg"
                  onClick={() => {
                    setJustSubmitted(false);
                    setJustApproved(false);
                    setAutoApproveError(null);
                    setIsAdding((current) => !current);
                  }}
                >
                  <span>{isAdding ? "-" : "+"}</span>
                  Submit a bobblehead
                </button>
              </div>

              {isAdding ? (
                justSubmitted ? (
                  <div className="mb-5 rounded-lg border border-accent/35 bg-accent/10 p-4 text-sm font-semibold text-accent">
                    {justApproved
                      ? "Added — it's live for everyone now."
                      : autoApproveError
                        ? `Couldn't publish it automatically, so it's been sent to review. (${autoApproveError})`
                        : "Submitted — the admin will review it before it appears for everyone."}
                  </div>
                ) : (
                  <SubmitBobbleheadForm
                    teamSlug={team.slug}
                    communityBobbleheads={communityBobbleheads}
                    isDeleted={isDeleted}
                    onDone={(result) => {
                      setJustApproved(result.autoApproved);
                      setAutoApproveError(result.autoApproveError ?? null);
                      setJustSubmitted(true);
                    }}
                  />
                )
              ) : null}

              {allGiveaways.length > 0 ? (
                <BobbleheadCollection allGiveaways={allGiveaways} team={team} />
              ) : (
                <div className="rounded-lg border border-dashed border-border-soft bg-surface p-8 text-center">
                  <p className="text-sm font-black uppercase tracking-wide text-navy">
                    No bobbleheads added yet
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    Submit the first bobblehead for this team.
                  </p>
                  <button
                    type="button"
                    className="mt-5 rounded bg-accent px-5 py-3 text-sm font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover"
                    onClick={() => setIsAdding(true)}
                  >
                    Submit a bobblehead
                  </button>
                </div>
              )}
            </section>
          </div>
        </WantedProvider>
      </FavoritesProvider>
    </OwnershipProvider>
  );
}
