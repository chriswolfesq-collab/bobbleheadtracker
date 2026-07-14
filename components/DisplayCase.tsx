import Image from "next/image";
import Link from "next/link";
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
const BOBBLEHEAD_SLOT_WIDTH = "7.3%";

function ShelfBobblehead({ team, x, y }: { team: Team; x: number; y: number }) {
  return (
    <Link
      href={`/teams/${team.slug}`}
      aria-label={`${team.city} ${team.name} bobblehead checklist`}
      className="group absolute z-0 -translate-x-1/2 outline-none hover:z-20 focus:z-20"
      style={{ left: `${x}%`, bottom: `${100 - y}%`, width: BOBBLEHEAD_SLOT_WIDTH }}
    >
      {/* tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-amber-400/40 bg-[#101827]/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-50 opacity-0 shadow-xl transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 sm:text-[11px]">
        {team.name}
        <span className="ml-1.5 font-normal normal-case text-amber-100/60">{team.city}</span>
      </div>

      <div className="origin-bottom transition-transform duration-200 ease-out group-hover:scale-[1.12] group-focus-visible:scale-[1.12]">
        <div className="origin-bottom group-hover:animate-bobble">
          <Image
            src={`/bobbleheads/${team.slug}.png`}
            alt=""
            width={677}
            height={1607}
            sizes="(max-width: 640px) 7vw, 49px"
            className="h-auto w-full drop-shadow-[0_5px_6px_rgba(0,0,0,0.6)]"
          />
        </div>
      </div>
    </Link>
  );
}

export default function DisplayCase() {
  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 sm:px-6">
      <div className="relative aspect-[1024/1538] w-full">
        <Image
          src="/shelf-even.jpg"
          alt="MLB Bobblehead Shelf"
          fill
          priority
          className="pointer-events-none select-none object-contain"
        />

        {SHELVES.map(({ league, division, floor }) => {
          const teams = TEAMS.filter((t) => t.league === league && t.division === division);
          return teams.map((team, i) => (
            <ShelfBobblehead key={team.slug} team={team} x={SLOT_X[i]} y={floor} />
          ));
        })}
      </div>
    </div>
  );
}
