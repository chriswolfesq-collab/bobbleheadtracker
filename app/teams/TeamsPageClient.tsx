"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CaseBanner } from "@/components/CaseBanner";
import { FeatureStrip } from "@/components/FeatureStrip";
import {
  PlankShelf,
  SHELF_FIGURE_CLASS,
  SHELF_FIGURE_SIZES,
  SHELF_PLAQUE_SIZE,
  SHELF_PLATE_SIZE,
  ShelfWall,
} from "@/components/PlankShelf";
import { NamePlate } from "@/components/ui/NamePlate";
import { publicAsset } from "@/lib/paths";
import { TEAMS, type Team } from "@/lib/teams";

type DivisionKey = `${"AL" | "NL"} ${"East" | "Central" | "West"}`;
type SortKey = "name" | "city" | "division";
type View = "grid" | "list";

// Display order for the six shelves.
const DIVISIONS: DivisionKey[] = [
  "AL East",
  "AL Central",
  "AL West",
  "NL East",
  "NL Central",
  "NL West",
];

const FIELD_CLASSES =
  "rounded border border-border-soft bg-surface px-3 py-2 text-sm font-semibold text-navy outline-none transition focus:border-accent";

function divisionOf(team: Team): DivisionKey {
  return `${team.league} ${team.division}`;
}

function ShelfFigure({ team }: { team: Team }) {
  return (
    <Link
      href={`/teams/${team.slug}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Image
        src={publicAsset(`/bobbleheads/${team.slug}.png`)}
        alt={`${team.city} ${team.name} bobblehead`}
        width={135}
        height={321}
        sizes={SHELF_FIGURE_SIZES}
        className={`w-auto object-contain drop-shadow-[0_8px_8px_rgba(58,36,18,0.4)] transition group-hover:scale-105 group-hover:animate-bobble ${SHELF_FIGURE_CLASS}`}
      />
    </Link>
  );
}

function ShelfPlate({ team }: { team: Team }) {
  return (
    <Link
      href={`/teams/${team.slug}`}
      className="min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <NamePlate size={SHELF_PLATE_SIZE} className="max-w-full truncate">
        {team.name}
      </NamePlate>
    </Link>
  );
}

export function TeamsPageClient() {
  const [division, setDivision] = useState("");
  const [league, setLeague] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setView] = useState<View>("grid");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const teams = TEAMS.filter((team) => {
      if (division && divisionOf(team) !== division) return false;
      if (league && team.league !== league) return false;
      if (q && !`${team.city} ${team.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return teams.sort((a, b) => {
      if (sort === "city") return a.city.localeCompare(b.city);
      if (sort === "division") return divisionOf(a).localeCompare(divisionOf(b));
      return a.name.localeCompare(b.name);
    });
  }, [division, league, query, sort]);

  const byDivision = useMemo(() => {
    const groups = new Map<DivisionKey, Team[]>();
    for (const d of DIVISIONS) groups.set(d, []);
    for (const team of filtered) groups.get(divisionOf(team))?.push(team);
    return groups;
  }, [filtered]);

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        {/* Display-case banner */}
        <CaseBanner
          preload
          overlay={
            <>
              <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-navy lg:text-5xl">
                All Teams
              </h1>
              <p className="mt-1 text-sm text-zinc-600 lg:text-base">Browse all 30 MLB teams</p>
            </>
          }
          card={
            <div className="w-full rounded-lg border border-border-soft bg-surface/90 px-3 py-2.5 text-center shadow-sm lg:px-4 lg:py-4">
              <p className="font-display text-lg font-bold uppercase tracking-wide text-navy lg:text-2xl">
                {TEAMS.length} Teams
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-600 lg:text-sm">
                One collection.
                <br />
                Every team.
              </p>
            </div>
          }
          mobile={
            <>
              <p className="font-display text-4xl font-bold uppercase tracking-wide text-navy">
                All Teams
              </p>
              <p className="mt-2 text-base text-zinc-600">
                Browse all {TEAMS.length} MLB teams. One collection. Every team.
              </p>
            </>
          }
        />

        {/* Filter bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border-soft bg-surface px-4 py-3">
          <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
            Filter by:
          </span>
          <select
            value={division}
            onChange={(event) => setDivision(event.target.value)}
            aria-label="Filter by division"
            className={FIELD_CLASSES}
          >
            <option value="">All Divisions</option>
            {DIVISIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={league}
            onChange={(event) => setLeague(event.target.value)}
            aria-label="Filter by league"
            className={FIELD_CLASSES}
          >
            <option value="">All Leagues</option>
            <option value="AL">American League</option>
            <option value="NL">National League</option>
          </select>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Teams"
            aria-label="Search teams"
            className={`${FIELD_CLASSES} min-w-36 flex-1`}
          />
          <span className="ml-auto text-xs font-black uppercase tracking-wide text-zinc-500">
            Sort by:
          </span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label="Sort teams"
            className={FIELD_CLASSES}
          >
            <option value="name">Team Name A–Z</option>
            <option value="city">City A–Z</option>
            <option value="division">Division</option>
          </select>
          <div className="flex overflow-hidden rounded border border-border-soft" role="group" aria-label="View">
            <button
              type="button"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
              className={`px-3 py-2 text-xs font-black uppercase tracking-wide transition ${
                view === "grid" ? "bg-accent text-accent-fg" : "bg-surface text-navy hover:bg-surface-muted"
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              className={`px-3 py-2 text-xs font-black uppercase tracking-wide transition ${
                view === "list" ? "bg-accent text-accent-fg" : "bg-surface text-navy hover:bg-surface-muted"
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-border-soft bg-surface p-10 text-center">
            <p className="font-display text-lg font-bold uppercase tracking-wide text-navy">
              No teams match
            </p>
            <p className="mt-2 text-sm text-zinc-600">Try clearing a filter or two.</p>
          </div>
        ) : view === "grid" ? (
          <ShelfWall className="mt-8">
            {DIVISIONS.map((d) => {
              const teams = byDivision.get(d) ?? [];
              if (teams.length === 0) return null;
              return (
                <PlankShelf
                  key={d}
                  ariaLabel={d}
                  figures={teams.map((team) => (
                    <ShelfFigure key={team.slug} team={team} />
                  ))}
                  plates={teams.map((team) => (
                    <ShelfPlate key={team.slug} team={team} />
                  ))}
                  plaque={
                    <NamePlate variant="brass" size={SHELF_PLAQUE_SIZE}>
                      {d}
                    </NamePlate>
                  }
                />
              );
            })}
          </ShelfWall>
        ) : (
          <ul className="mt-8 divide-y divide-border-soft overflow-hidden rounded-xl border border-border-soft bg-surface">
            {filtered.map((team) => (
              <li key={team.slug}>
                <Link
                  href={`/teams/${team.slug}`}
                  className="flex items-center gap-4 px-4 py-3 transition hover:bg-surface-muted"
                >
                  <Image
                    src={publicAsset(`/bobbleheads/${team.slug}.png`)}
                    alt=""
                    aria-hidden
                    width={54}
                    height={128}
                    className="h-12 w-auto object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-bold uppercase tracking-wide text-navy">
                      {team.city} {team.name}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-surface-muted px-2.5 py-1 text-xs font-black uppercase tracking-wide text-navy">
                    {divisionOf(team)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <FeatureStrip className="mt-12" />
      </div>
    </div>
  );
}
