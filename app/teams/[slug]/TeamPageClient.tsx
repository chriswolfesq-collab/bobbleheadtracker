"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminModeBadge } from "@/components/AdminModeBadge";
import { AuthWidget } from "@/components/AuthWidget";
import { useApprovedPhotos } from "@/lib/approvedPhotos";
import { useAuth } from "@/lib/auth";
import type { Giveaway } from "@/lib/bobbleheads";
import { useCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { findDuplicateBobblehead, type DuplicateCandidate } from "@/lib/duplicateCheck";
import { publicAsset } from "@/lib/paths";
import { submitNewBobblehead } from "@/lib/submissions";
import type { Team } from "@/lib/teams";
import { GiveawayCard, OwnedCount, OwnershipProvider, type ResolvedGiveaway } from "./GiveawayCard";

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
        <div className="text-xl font-black leading-none text-amber-400 sm:text-3xl">{value}</div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-200 sm:text-xs">{label}</div>
      </div>
    </div>
  );
}

function SubmitBobbleheadForm({
  teamSlug,
  communityBobbleheads,
  onDone,
}: {
  teamSlug: string;
  communityBobbleheads: DuplicateCandidate[];
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateCandidate | null>(null);

  if (!user) {
    return (
      <div className="mb-5 rounded-lg border border-amber-400/35 bg-amber-400/10 p-4 text-sm text-zinc-100">
        Log in to submit a bobblehead for review.
      </div>
    );
  }

  return (
    <form
      className="mb-5 grid gap-3 rounded-lg border border-amber-400/35 bg-amber-400/10 p-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!file) {
          setError("A photo is required.");
          return;
        }

        if (!duplicateMatch) {
          const match = findDuplicateBobblehead(teamSlug, title, communityBobbleheads);
          if (match) {
            setDuplicateMatch(match);
            return;
          }
        }

        setIsSubmitting(true);
        setError(null);

        try {
          await submitNewBobblehead({ user, teamSlug, title, date, file });
          onDone();
        } catch (submitError) {
          setError(submitError instanceof Error ? submitError.message : "Could not submit bobblehead.");
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <label className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-amber-300">Name</span>
        <input
          required
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setDuplicateMatch(null);
          }}
          placeholder="Fernando Valenzuela"
          className="mt-1 w-full rounded border border-white/15 bg-[#07111d] px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
        />
      </label>
      <label className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-amber-300">Date</span>
        <input
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setDuplicateMatch(null);
          }}
          placeholder="July 14, 2026"
          className="mt-1 w-full rounded border border-white/15 bg-[#07111d] px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
        />
      </label>
      <label className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-amber-300">Photo</span>
        <input
          required
          type="file"
          accept="image/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="mt-1 w-full text-xs text-zinc-200 file:mr-2 file:rounded file:border-0 file:bg-amber-500 file:px-2 file:py-1.5 file:text-xs file:font-black file:uppercase file:text-[#07111d]"
        />
      </label>
      <div className="flex items-end gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-10 rounded bg-amber-500 px-4 text-sm font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300 disabled:opacity-60"
        >
          {isSubmitting ? "Submitting…" : duplicateMatch ? "Submit anyway" : "Submit"}
        </button>
      </div>
      {duplicateMatch ? (
        <p className="text-xs font-semibold text-amber-300 sm:col-span-4">
          This looks like it might already be on the shelf: “{duplicateMatch.title}” ({duplicateMatch.date}).
          Click submit again to add it anyway.
        </p>
      ) : null}
      {error ? <p className="text-xs font-semibold text-red-400 sm:col-span-4">{error}</p> : null}
      <p className="text-xs leading-5 text-zinc-300 sm:col-span-4">
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
  const { communityBobbleheads } = useCommunityBobbleheads(team.slug);
  const { photoUrlById } = useApprovedPhotos(team.slug);

  const allGiveaways = useMemo<ResolvedGiveaway[]>(() => {
    const curated: ResolvedGiveaway[] = giveaways.map((giveaway) => ({
      ...giveaway,
      imageUrl: photoUrlById[giveaway.id] ?? giveaway.imageUrl,
      source: "curated",
    }));
    const community: ResolvedGiveaway[] = communityBobbleheads.map((giveaway) => ({
      ...giveaway,
      imageUrl: photoUrlById[giveaway.id] ?? giveaway.imageUrl,
      source: "community",
    }));

    return [...community, ...curated];
  }, [giveaways, communityBobbleheads, photoUrlById]);

  const photoCount = useMemo(
    () => allGiveaways.filter((giveaway) => giveaway.imageUrl).length,
    [allGiveaways],
  );

  return (
    <OwnershipProvider teamSlug={team.slug}>
      <main className="min-h-full bg-[#15110d] px-3 py-3 text-zinc-100 sm:px-5 sm:py-5">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-xl border border-black bg-[#08131f] shadow-2xl">
          <section
            className="grid gap-4 border-b border-white/10 p-4 sm:gap-6 sm:p-5 lg:grid-cols-[220px_1fr]"
            style={{
              background: `radial-gradient(circle at 74% 14%, ${team.primary}44, transparent 34%), linear-gradient(135deg, #08131f 0%, #0b1d2e 52%, #07111d 100%)`,
            }}
          >
            <aside className="lg:border-r lg:border-white/10 lg:pr-5">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white hover:text-amber-300"
                >
                  <span aria-hidden>←</span>
                  Back to shelf
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AdminModeBadge />
                <AuthWidget />
              </div>

              <div className="mt-5 hidden rounded border border-white/15 bg-black/25 p-3 text-center lg:block">
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
                <div className="mt-2 rounded bg-black/45 px-2 py-1 text-sm font-black uppercase tracking-wide">
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
                    <p className="mt-2 text-sm font-black uppercase tracking-wide text-amber-400 sm:mt-3 sm:text-xl">
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
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-100 transition hover:border-amber-400 hover:text-amber-300 sm:px-5 sm:py-3 sm:text-sm"
                >
                  <span>✎</span>
                  Edit team
                </button>
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
          </section>

          <section className="m-2 rounded-lg border border-white/10 bg-[#0b1a29] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:m-3 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-black uppercase tracking-wide text-zinc-100">SGA Bobbleheads</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded border border-amber-400 px-4 py-2 text-sm font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-[#07111d]"
                  onClick={() => {
                    setJustSubmitted(false);
                    setIsAdding((current) => !current);
                  }}
                >
                  <span>{isAdding ? "-" : "+"}</span>
                  Submit a bobblehead
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-start gap-2 self-start text-sm font-bold uppercase tracking-wide text-zinc-100 sm:self-auto"
                >
                  Sort: Release date (newest)
                  <span className="text-lg">⌄</span>
                </button>
              </div>
            </div>

            {isAdding ? (
              justSubmitted ? (
                <div className="mb-5 rounded-lg border border-amber-400/35 bg-amber-400/10 p-4 text-sm font-semibold text-amber-200">
                  Submitted — the admin will review it before it appears for everyone.
                </div>
              ) : (
                <SubmitBobbleheadForm
                  teamSlug={team.slug}
                  communityBobbleheads={communityBobbleheads}
                  onDone={() => setJustSubmitted(true)}
                />
              )
            ) : null}

            {allGiveaways.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
                {allGiveaways.map((giveaway, index) => (
                  <GiveawayCard
                    key={giveaway.id}
                    giveaway={giveaway}
                    team={team}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/15 bg-black/15 p-8 text-center">
                <p className="text-sm font-black uppercase tracking-wide text-zinc-100">
                  No bobbleheads added yet
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Submit the first bobblehead for this team.
                </p>
                <button
                  type="button"
                  className="mt-5 rounded bg-amber-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300"
                  onClick={() => setIsAdding(true)}
                >
                  Submit a bobblehead
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </OwnershipProvider>
  );
}
