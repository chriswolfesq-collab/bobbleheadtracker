"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminModeBadge } from "@/components/AdminModeBadge";
import { AuthWidget } from "@/components/AuthWidget";
import { useApprovedPhotos } from "@/lib/approvedPhotos";
import { useAuth } from "@/lib/auth";
import type { Giveaway } from "@/lib/bobbleheads";
import { useBobbleheadOverrides, type BobbleheadOverridesLookup } from "@/lib/bobbleheadOverrides";
import { useCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { findDuplicateBobblehead, type DuplicateCandidate } from "@/lib/duplicateCheck";
import { publicAsset } from "@/lib/paths";
import { submitNewBobblehead } from "@/lib/submissions";
import type { Team } from "@/lib/teams";
import { BobbleheadCollection, DEFAULT_SORT_ORDER, SORT_OPTIONS, type SortOrder } from "./BobbleheadCollection";
import { FavoritesProvider, OwnedCount, OwnershipProvider, WantedProvider, type ResolvedGiveaway } from "./GiveawayCard";

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

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:items-center sm:gap-3 sm:text-left">
      <div className="hidden h-12 w-12 shrink-0 place-items-center text-3xl text-zinc-200 sm:grid">{icon}</div>
      <div>
        <div className="text-xl font-black leading-none text-accent sm:text-3xl">{value}</div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-200 sm:text-xs">{label}</div>
      </div>
    </div>
  );
}

function SortMenu({
  value,
  onChange,
}: {
  value: SortOrder;
  onChange: (value: SortOrder) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const currentLabel = SORT_OPTIONS.find((option) => option.value === value)?.label ?? "";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center justify-start gap-2 self-start text-sm font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-100 sm:self-auto"
      >
        Sort: {currentLabel}
        <span className="text-lg">⌄</span>
      </button>
      {isOpen ? (
        <ul
          role="listbox"
          className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-black/10 bg-white py-1 shadow-xl dark:border-white/15 dark:bg-[#0b1a29]"
        >
          {SORT_OPTIONS.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide transition hover:bg-black/[0.06] dark:hover:bg-white/10 ${
                  option.value === value ? "text-accent" : "text-zinc-800 dark:text-zinc-200"
                }`}
              >
                {option.label}
                {option.value === value ? <span aria-hidden>✓</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SubmitBobbleheadForm({
  teamSlug,
  communityBobbleheads,
  isDeleted,
  onDone,
}: {
  teamSlug: string;
  communityBobbleheads: DuplicateCandidate[];
  isDeleted: BobbleheadOverridesLookup["isDeleted"];
  onDone: (autoApproved: boolean) => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [nickname, setNickname] = useState("");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState("");
  const [dateUnknown, setDateUnknown] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateCandidate | null>(null);

  if (!user) {
    return (
      <div className="mb-5 rounded-lg border border-accent/35 bg-accent/10 p-4 text-sm text-zinc-900 dark:text-zinc-100">
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
          const match = findDuplicateBobblehead(teamSlug, title, communityBobbleheads, isDeleted);
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
            quantity,
            date: dateUnknown ? "N/A" : formatSubmissionDate(date),
            file,
          });
          onDone(result.autoApproved);
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
        <span className="text-xs font-black uppercase tracking-wide text-accent">Name</span>
        <input
          required
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setDuplicateMatch(null);
          }}
          placeholder="Fernando Valenzuela"
          className="mt-1 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent dark:border-white/15 dark:bg-[#07111d] dark:text-white"
        />
      </label>
      <label className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-accent">Nickname</span>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="“El Toro” (optional)"
          className="mt-1 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent dark:border-white/15 dark:bg-[#07111d] dark:text-white"
        />
      </label>
      <label className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-accent">Number Given Away</span>
        <input
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="25,000 (optional)"
          className="mt-1 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent dark:border-white/15 dark:bg-[#07111d] dark:text-white"
        />
      </label>
      <label className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-accent">Date</span>
        <input
          type="date"
          value={date}
          disabled={dateUnknown}
          onChange={(event) => {
            setDate(event.target.value);
            setDuplicateMatch(null);
          }}
          className="mt-1 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none transition [color-scheme:light] focus:border-accent disabled:opacity-50 dark:border-white/15 dark:bg-[#07111d] dark:text-white dark:[color-scheme:dark]"
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
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
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
          className="mt-1 w-full text-xs text-zinc-800 dark:text-zinc-200 file:mr-2 file:rounded file:border-0 file:bg-accent file:px-2 file:py-1.5 file:text-xs file:font-black file:uppercase file:text-accent-fg"
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
      {error ? <p className="text-xs font-semibold text-red-400 sm:col-span-6">{error}</p> : null}
      <p className="text-xs leading-5 text-zinc-700 dark:text-zinc-300 sm:col-span-6">
        Submitted bobbleheads are reviewed by the site admin before they appear for everyone.
      </p>
    </form>
  );
}

export function TeamPageClient({
  established,
  giveaways,
  team,
}: {
  established: string;
  giveaways: Giveaway[];
  team: Team;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [justApproved, setJustApproved] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);
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
          imageUrl: photoUrlById[giveaway.id] ?? giveaway.imageUrl,
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

  const photoCount = useMemo(
    () => allGiveaways.filter((giveaway) => giveaway.imageUrl).length,
    [allGiveaways],
  );

  return (
    <OwnershipProvider teamSlug={team.slug}>
      <FavoritesProvider teamSlug={team.slug}>
        <WantedProvider teamSlug={team.slug}>
          <main className="min-h-full bg-slate-50 px-3 py-3 text-zinc-900 dark:bg-[#15110d] dark:text-zinc-100 sm:px-5 sm:py-5">
            <div className="mx-auto max-w-7xl overflow-hidden rounded-xl border border-black bg-white shadow-2xl dark:bg-[#08131f]">
              {/* This hero keeps its team-colored dark gradient in both themes.
                  The `dark` class scopes everything inside it to dark-surface
                  styling so shared chrome (AuthWidget, etc.) stays legible on it
                  even when the rest of the page is in light mode. */}
              <section
                className="dark border-b border-white/10 p-4 sm:p-5"
                style={{
                  background: `radial-gradient(circle at 74% 14%, ${team.primary}44, transparent 34%), linear-gradient(135deg, #08131f 0%, #0b1d2e 52%, #07111d 100%)`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white hover:text-accent-hover"
                  >
                    <span aria-hidden>←</span>
                    Back to shelf
                  </Link>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <AdminModeBadge />
                    <AuthWidget />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-[220px_1fr]">
                <aside className="lg:border-r lg:border-white/10 lg:pr-5">
                  <div className="hidden rounded border border-white/15 bg-black/25 p-3 text-center lg:block">
                    <div className="flex h-48 items-end justify-center rounded bg-[radial-gradient(circle_at_50%_24%,rgba(255,255,255,0.18),rgba(255,255,255,0)_46%)]">
                      <Image
                        src={publicAsset(`/bobbleheads/${team.slug}.png`)}
                        alt={`${team.city} ${team.name} bobblehead`}
                        width={268}
                        height={630}
                        priority
                        className="h-44 w-auto drop-shadow-[0_12px_16px_rgba(0,0,0,0.65)]"
                      />
                    </div>
                    <div className="mt-2 rounded bg-black/45 px-2 py-1 text-sm font-black uppercase tracking-wide text-zinc-100">
                      {team.name}
                    </div>
                  </div>
                </aside>

                <div className="grid gap-5 xl:grid-cols-[1fr_210px] xl:gap-7">
                  <div>
                    <div className="flex flex-row items-center gap-4 sm:items-start sm:gap-5">
                      <div
                        className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded bg-black/25 text-2xl font-black text-white sm:h-24 sm:w-24 sm:bg-transparent sm:text-4xl lg:hidden"
                        style={{ color: team.secondary === "#FFFFFF" ? "#f8fafc" : team.secondary }}
                      >
                        <Image
                          src={publicAsset(`/bobbleheads/${team.slug}.png`)}
                          alt={`${team.city} ${team.name} bobblehead`}
                          width={268}
                          height={630}
                          priority
                          className="absolute inset-0 h-full w-full object-contain sm:hidden"
                        />
                        <span className="hidden sm:inline">{team.abbr}</span>
                      </div>
                      <div
                        className="hidden h-24 w-24 shrink-0 place-items-center text-4xl font-black text-white lg:grid"
                        style={{ color: team.secondary === "#FFFFFF" ? "#f8fafc" : team.secondary }}
                      >
                        {team.abbr}
                      </div>
                      <div>
                        <h1 className="text-2xl font-black uppercase leading-none tracking-wide text-white sm:text-4xl sm:leading-none 2xl:text-6xl">
                          {team.city} {team.name}
                        </h1>
                        <p className="mt-2 text-sm font-black uppercase tracking-wide text-accent sm:mt-3 sm:text-xl">
                          {team.league} {team.division}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3 sm:mt-9 sm:gap-6">
                      <Stat icon={<span>♟</span>} value={allGiveaways.length} label="Bobbleheads" />
                      <Stat icon={<span>✓</span>} value={<OwnedCount />} label="Owned" />
                      <Stat icon={<span>▣</span>} value={photoCount} label="Photos" />
                    </div>
                  </div>

                  <div className="flex flex-row items-center justify-between gap-4 xl:flex-col xl:items-end">
                    <div className="space-y-1 text-right xl:space-y-3 xl:text-right">
                      <p className="hidden text-sm font-black uppercase tracking-wide text-zinc-200 xl:block">
                        ⓘ Team info
                      </p>
                      <div className="text-xs leading-5 text-zinc-300 sm:text-sm sm:leading-7 sm:text-zinc-200 xl:pt-4">
                        <p className="uppercase">Est. {established}</p>
                        <p>
                          {team.city}, {team.league} {team.division}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </section>

              <section className="m-2 rounded-lg border border-black/10 bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] dark:border-white/10 dark:bg-[#0b1a29] sm:m-3 sm:p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-2xl font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">SGA Bobbleheads</h2>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded border border-accent px-4 py-2 text-sm font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg"
                      onClick={() => {
                        setJustSubmitted(false);
                        setJustApproved(false);
                        setIsAdding((current) => !current);
                      }}
                    >
                      <span>{isAdding ? "-" : "+"}</span>
                      Submit a bobblehead
                    </button>
                    <SortMenu value={sortOrder} onChange={setSortOrder} />
                  </div>
                </div>

                {isAdding ? (
                  justSubmitted ? (
                    <div className="mb-5 rounded-lg border border-accent/35 bg-accent/10 p-4 text-sm font-semibold text-accent">
                      {justApproved
                        ? "Added — it's live for everyone now."
                        : "Submitted — the admin will review it before it appears for everyone."}
                    </div>
                  ) : (
                    <SubmitBobbleheadForm
                      teamSlug={team.slug}
                      communityBobbleheads={communityBobbleheads}
                      isDeleted={isDeleted}
                      onDone={(autoApproved) => {
                        setJustApproved(autoApproved);
                        setJustSubmitted(true);
                      }}
                    />
                  )
                ) : null}

                {allGiveaways.length > 0 ? (
                  <BobbleheadCollection allGiveaways={allGiveaways} team={team} sortOrder={sortOrder} />
                ) : (
                  <div className="rounded-lg border border-dashed border-black/10 bg-black/15 p-8 text-center dark:border-white/15">
                    <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
                      No bobbleheads added yet
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
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
          </main>
        </WantedProvider>
      </FavoritesProvider>
    </OwnershipProvider>
  );
}
