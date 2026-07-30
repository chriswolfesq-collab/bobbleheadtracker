import Image from "next/image";
import Link from "next/link";
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

const SHELVES: { league: Team["league"]; division: Team["division"] }[] = [
  { league: "AL", division: "East" },
  { league: "AL", division: "Central" },
  { league: "AL", division: "West" },
  { league: "NL", division: "East" },
  { league: "NL", division: "Central" },
  { league: "NL", division: "West" },
];

/** Owned/total for one team, shown as a label on the shelf in collection mode. */
type TeamProgress = { count: number; total: number; pct: number };

// Teams have up to ~240 bobbleheads, so owning a few rounds to 0% and reads as
// untouched. Anything owned shows at least 1%; only a truly empty team shows 0%.
function toPct(count: number, total: number): number {
  if (total <= 0 || count <= 0) return 0;
  return Math.max(1, Math.round((count / total) * 100));
}

function ShelfLabel({ team, progress }: { team: Team; progress: TeamProgress }) {
  const isStarted = progress.count > 0;

  return (
    <div
      className={`overflow-hidden rounded border ${
        isStarted ? "border-amber-400/50" : "border-white/15"
      } relative bg-[#101827]/95 shadow-lg`}
    >
      <div
        className="absolute inset-y-0 left-0 bg-amber-400/30"
        style={{ width: `${progress.pct}%` }}
      />
      {/* Steps with the shelf on the same breakpoints as the bare name plates
          (SHELF_PLATE_SIZE), so the collection view and the teams wall carry the
          same weight of label under the same size of figure. */}
      <div className="relative flex items-center gap-1 whitespace-nowrap px-1 py-[3px] text-[8px] font-black uppercase leading-none tracking-wide @min-[520px]:gap-1.5 @min-[520px]:px-1.5 @min-[760px]:gap-2 @min-[760px]:px-2.5 @min-[760px]:py-1.5 @min-[760px]:text-[11px]">
        {/* Abbreviation, not the full name: five labels share one plank, and
            "WHITE SOX 0/101 0%" overruns its neighbour. Full name and city stay
            available in the hover tooltip. */}
        <span className={isStarted ? "text-zinc-100" : "text-zinc-400"}>{team.abbr}</span>
        <span className={`tabular-nums ${isStarted ? "text-zinc-400" : "text-zinc-600"}`}>
          {progress.count}/{progress.total}
        </span>
        {/* On a narrow shelf the columns are ~60px wide and the percentage does
            not fit, so the amber fill behind the label carries it there instead.
            Keyed to the panel's own width, not the viewport, so the fixed-width
            share card keeps the percentage even when captured from a phone. */}
        <span
          className={`hidden tabular-nums @min-[520px]:inline ${
            isStarted ? "text-amber-300" : "text-zinc-600"
          }`}
        >
          {progress.pct}%
        </span>
      </div>
    </div>
  );
}

function CaseFigure({ team, progress }: { team: Team; progress?: TeamProgress }) {
  // In collection mode a team with nothing owned is dimmed to an empty slot.
  const isMuted = progress ? progress.count === 0 : false;

  return (
    <Link
      href={`/teams/${team.slug}`}
      aria-label={
        progress
          ? `${team.city} ${team.name} checklist, ${progress.count} of ${progress.total} owned`
          : `${team.city} ${team.name} bobblehead checklist`
      }
      className="group relative outline-none hover:z-20 focus:z-20"
    >
      {/* tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-amber-400/40 bg-[#101827]/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-50 opacity-0 shadow-xl transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 sm:text-[11px]">
        {team.name}
        <span className="ml-1.5 font-normal normal-case text-amber-100/60">{team.city}</span>
      </div>

      <div className="origin-bottom transition-transform duration-200 ease-out group-hover:scale-[1.12] group-focus-visible:scale-[1.12]">
        <div className="origin-bottom group-hover:animate-bobble">
          <Image
            src={publicAsset(`/bobbleheads/${team.slug}.png`)}
            alt=""
            width={677}
            height={1607}
            sizes={SHELF_FIGURE_SIZES}
            // The whole case is above the fold, so the default lazy deferral
            // just means the empty shelves paint first and the figures pop in
            // afterwards. Each one optimizes down to ~10KB, so load them with
            // the rest of the page instead.
            loading="eager"
            className={`w-auto drop-shadow-[0_5px_6px_rgba(0,0,0,0.5)] ${SHELF_FIGURE_CLASS} ${
              isMuted ? "opacity-25 grayscale" : ""
            }`}
          />
        </div>
      </div>
    </Link>
  );
}

/**
 * The bobblehead display wall: six photographed plank shelves (one per
 * division) on a parchment wall, all cropped from the BobbleShelf case
 * artwork. Rendered bare it shows navy abbreviation plates; pass
 * `countByTeamSlug` / `totalByTeamSlug` to get the profile's collection view,
 * which swaps the plates for owned/total labels and dims the teams with
 * nothing owned.
 */
export default function DisplayCase({
  countByTeamSlug,
  totalByTeamSlug,
}: {
  countByTeamSlug?: Record<string, number>;
  totalByTeamSlug?: Record<string, number>;
} = {}) {
  const isCollectionMode = Boolean(countByTeamSlug);

  return (
    // The gutter steps with the space the case is given, not the viewport: the
    // share card renders this at a fixed 800px, so a viewport-keyed `sm:` here
    // would make a card captured on a phone lay out differently from one
    // captured on a desktop.
    <div className="@container">
      <div className="relative mx-auto w-full max-w-6xl px-4 @min-[520px]:px-6">
        <ShelfWall>
          {SHELVES.map(({ league, division }) => {
            const teams = TEAMS.filter((t) => t.league === league && t.division === division);

            return (
              <PlankShelf
                key={`${league}-${division}`}
                ariaLabel={`${league} ${division}`}
                figures={teams.map((team) => {
                  const count = countByTeamSlug?.[team.slug] ?? 0;
                  const total = totalByTeamSlug?.[team.slug] ?? 0;
                  return (
                    <CaseFigure
                      key={team.slug}
                      team={team}
                      progress={
                        isCollectionMode ? { count, total, pct: toPct(count, total) } : undefined
                      }
                    />
                  );
                })}
                plates={teams.map((team) => {
                  if (!isCollectionMode) {
                    return (
                      <NamePlate key={team.slug} size={SHELF_PLATE_SIZE}>
                        {team.abbr}
                      </NamePlate>
                    );
                  }
                  const count = countByTeamSlug?.[team.slug] ?? 0;
                  const total = totalByTeamSlug?.[team.slug] ?? 0;
                  return (
                    <ShelfLabel
                      key={team.slug}
                      team={team}
                      progress={{ count, total, pct: toPct(count, total) }}
                    />
                  );
                })}
                plaque={
                  <NamePlate variant="brass" size={SHELF_PLAQUE_SIZE}>
                    {`${league} ${division}`}
                  </NamePlate>
                }
              />
            );
          })}
        </ShelfWall>
      </div>
    </div>
  );
}
