"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Giveaway } from "@/lib/bobbleheads";
import { useCustomBobbleheads } from "@/lib/customBobbleheads";
import { publicAsset } from "@/lib/paths";
import type { Team } from "@/lib/teams";
import { GiveawayCard, OwnedCount, OwnershipProvider } from "./GiveawayCard";

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
    <div className="flex items-center gap-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center text-3xl text-zinc-200">{icon}</div>
      <div>
        <div className="text-3xl font-black leading-none text-amber-400">{value}</div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-200">{label}</div>
      </div>
    </div>
  );
}

function AddBobbleheadForm({
  onAdd,
}: {
  onAdd: (input: { title: string; year: string; date: string; owned: boolean }) => void;
}) {
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [date, setDate] = useState("");
  const [owned, setOwned] = useState(true);

  return (
    <form
      className="mb-5 grid gap-3 rounded-lg border border-amber-400/35 bg-amber-400/10 p-4 sm:grid-cols-[minmax(0,1.35fr)_110px_minmax(0,1fr)_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        onAdd({ title, year, date, owned });
        setTitle("");
        setYear("");
        setDate("");
        setOwned(true);
      }}
    >
      <label className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-amber-300">Name</span>
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Fernando Valenzuela"
          className="mt-1 w-full rounded border border-white/15 bg-[#07111d] px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
        />
      </label>
      <label>
        <span className="text-xs font-black uppercase tracking-wide text-amber-300">Year</span>
        <input
          value={year}
          onChange={(event) => setYear(event.target.value)}
          placeholder="2026"
          className="mt-1 w-full rounded border border-white/15 bg-[#07111d] px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
        />
      </label>
      <label className="min-w-0">
        <span className="text-xs font-black uppercase tracking-wide text-amber-300">Date</span>
        <input
          value={date}
          onChange={(event) => setDate(event.target.value)}
          placeholder="July 14, 2026"
          className="mt-1 w-full rounded border border-white/15 bg-[#07111d] px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
        />
      </label>
      <div className="flex items-end gap-3">
        <label className="flex min-h-10 items-center gap-2 rounded border border-white/15 px-3 text-sm font-bold text-zinc-100">
          <input
            type="checkbox"
            checked={owned}
            onChange={(event) => setOwned(event.target.checked)}
            className="h-4 w-4 accent-amber-400"
          />
          Owned
        </label>
        <button
          type="submit"
          className="min-h-10 rounded bg-amber-500 px-4 text-sm font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300"
        >
          Add
        </button>
      </div>
    </form>
  );
}

export function TeamPageClient({
  established,
  giveaways,
  photoCount,
  team,
}: {
  established: string;
  giveaways: Giveaway[];
  photoCount: number;
  team: Team;
}) {
  const { customBobbleheads, addCustomBobblehead } = useCustomBobbleheads(team.slug);
  const [isAdding, setIsAdding] = useState(false);
  const allGiveaways = useMemo(
    () => [...customBobbleheads, ...giveaways],
    [customBobbleheads, giveaways],
  );

  return (
    <OwnershipProvider giveaways={allGiveaways}>
      <main className="min-h-full bg-[#15110d] px-3 py-3 text-zinc-100 sm:px-5 sm:py-5">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-xl border border-black bg-[#08131f] shadow-2xl">
          <section
            className="grid gap-6 border-b border-white/10 p-5 lg:grid-cols-[220px_1fr]"
            style={{
              background: `radial-gradient(circle at 74% 14%, ${team.primary}44, transparent 34%), linear-gradient(135deg, #08131f 0%, #0b1d2e 52%, #07111d 100%)`,
            }}
          >
            <aside className="lg:border-r lg:border-white/10 lg:pr-5">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white hover:text-amber-300"
              >
                <span aria-hidden>←</span>
                Back to shelf
              </Link>

              <div className="mt-5 rounded border border-white/15 bg-black/25 p-3 text-center">
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

            <div className="grid gap-7 xl:grid-cols-[1fr_210px]">
              <div>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div
                    className="grid h-24 w-24 shrink-0 place-items-center text-4xl font-black text-white"
                    style={{ color: team.secondary === "#FFFFFF" ? "#f8fafc" : team.secondary }}
                  >
                    {team.abbr}
                  </div>
                  <div>
                    <h1 className="text-4xl font-black uppercase leading-none tracking-wide text-white sm:text-5xl 2xl:text-6xl">
                      {team.city} {team.name}
                    </h1>
                    <p className="mt-3 text-xl font-black uppercase tracking-wide text-amber-400">
                      {team.league} {team.division}
                    </p>
                  </div>
                </div>

                <div className="mt-9 grid gap-6 sm:grid-cols-3">
                  <Stat icon={<span>♟</span>} value={allGiveaways.length} label="Bobbleheads" />
                  <Stat icon={<span>✓</span>} value={<OwnedCount />} label="Owned" />
                  <Stat icon={<span>▣</span>} value={photoCount} label="Photos" />
                </div>
              </div>

              <div className="flex flex-col items-start gap-6 xl:items-end">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-bold uppercase tracking-wide text-zinc-100 transition hover:border-amber-400 hover:text-amber-300"
                >
                  <span>✎</span>
                  Edit team
                </button>
                <div className="space-y-3 text-left xl:text-right">
                  <p className="text-sm font-black uppercase tracking-wide text-zinc-200">ⓘ Team info</p>
                  <div className="pt-4 text-sm leading-7 text-zinc-200">
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
                  onClick={() => setIsAdding((current) => !current)}
                >
                  <span>{isAdding ? "-" : "+"}</span>
                  Add bobblehead
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
              <AddBobbleheadForm
                onAdd={(input) => {
                  addCustomBobblehead(input);
                  setIsAdding(false);
                }}
              />
            ) : null}

            {allGiveaways.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
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
                  Add the first bobblehead for this team.
                </p>
                <button
                  type="button"
                  className="mt-5 rounded bg-amber-500 px-5 py-3 text-sm font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300"
                  onClick={() => setIsAdding(true)}
                >
                  Add bobblehead
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </OwnershipProvider>
  );
}
