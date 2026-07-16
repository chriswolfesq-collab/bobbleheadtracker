import Image from "next/image";
import Link from "next/link";
import { publicAsset } from "@/lib/paths";
import { TEAMS, type Team } from "@/lib/teams";

const SHELVES: { league: Team["league"]; division: Team["division"]; floor: number }[] = [
  { league: "AL", division: "East", floor: 25.2 },
  { league: "AL", division: "Central", floor: 39.1 },
  { league: "AL", division: "West", floor: 53.0 },
  { league: "NL", division: "East", floor: 66.9 },
  { league: "NL", division: "Central", floor: 80.8 },
  { league: "NL", division: "West", floor: 94.7 },
];

// 5 evenly spaced horizontal slots per shelf
const SLOT_X = [14, 32, 50, 68, 86];
const BOBBLEHEAD_SLOT_HEIGHT = "11%";

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
      className={`pointer-events-none absolute left-1/2 top-full z-10 -translate-x-1/2 -translate-y-[72%] overflow-hidden rounded border ${
        isStarted ? "border-amber-400/50" : "border-white/15"
      } bg-[#101827]/95 shadow-lg`}
    >
      <div
        className="absolute inset-y-0 left-0 bg-amber-400/30"
        style={{ width: `${progress.pct}%` }}
      />
      <div className="relative flex items-center gap-1 whitespace-nowrap px-1 py-[3px] text-[8px] font-black uppercase leading-none tracking-wide @min-[520px]:gap-1.5 @min-[520px]:px-1.5">
        {/* Abbreviation, not the full name: slots are only ~18% of the shelf apart,
            and "WHITE SOX 0/101 0%" overruns its neighbour. Full name and city stay
            available in the hover tooltip. */}
        <span className={isStarted ? "text-zinc-100" : "text-zinc-400"}>{team.abbr}</span>
        <span className={`tabular-nums ${isStarted ? "text-zinc-400" : "text-zinc-600"}`}>
          {progress.count}/{progress.total}
        </span>
        {/* On a narrow shelf the slots are ~56px apart and the percentage does not
            fit, so the amber fill behind the label carries it there instead. Keyed
            to the shelf's own width, not the viewport, so the fixed-width share
            card keeps the percentage even when captured from a phone. */}
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

function ShelfBobblehead({
  team,
  x,
  y,
  progress,
}: {
  team: Team;
  x: number;
  y: number;
  progress?: TeamProgress;
}) {
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
      className="group absolute z-0 -translate-x-1/2 outline-none hover:z-20 focus:z-20"
      style={{ left: `${x}%`, bottom: `${100 - y}%`, height: BOBBLEHEAD_SLOT_HEIGHT }}
    >
      {/* tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-amber-400/40 bg-[#101827]/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-50 opacity-0 shadow-xl transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 sm:text-[11px]">
        {team.name}
        <span className="ml-1.5 font-normal normal-case text-amber-100/60">{team.city}</span>
      </div>

      <div className="h-full origin-bottom transition-transform duration-200 ease-out group-hover:scale-[1.12] group-focus-visible:scale-[1.12]">
        <div className="relative h-full origin-bottom group-hover:animate-bobble">
          <Image
            src={publicAsset(`/bobbleheads/${team.slug}.png`)}
            alt=""
            width={677}
            height={1607}
            sizes="(max-width: 640px) 9vw, 60px"
            className={`h-full w-auto drop-shadow-[0_5px_6px_rgba(0,0,0,0.6)] ${
              isMuted ? "opacity-25 grayscale" : ""
            }`}
          />
        </div>
      </div>

      {progress ? <ShelfLabel team={team} progress={progress} /> : null}
    </Link>
  );
}

/**
 * The bobblehead shelf. Rendered bare on the home page; pass `countByTeamSlug` /
 * `totalByTeamSlug` to get the profile's collection view, which adds an
 * owned/total label under each team and dims the teams with nothing owned.
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
    <div className="relative mx-auto w-full max-w-2xl px-4 sm:px-6">
      <div className="@container relative aspect-[1024/1538] w-full">
        <Image
          src={publicAsset("/shelf-even.jpg")}
          alt="MLB Bobblehead Shelf"
          fill
          priority
          className="pointer-events-none select-none object-contain"
        />

        {SHELVES.map(({ league, division, floor }) => {
          const teams = TEAMS.filter((t) => t.league === league && t.division === division);
          return teams.map((team, i) => {
            const count = countByTeamSlug?.[team.slug] ?? 0;
            const total = totalByTeamSlug?.[team.slug] ?? 0;

            return (
              <ShelfBobblehead
                key={team.slug}
                team={team}
                x={SLOT_X[i]}
                y={floor}
                progress={isCollectionMode ? { count, total, pct: toPct(count, total) } : undefined}
              />
            );
          });
        })}
      </div>
    </div>
  );
}
