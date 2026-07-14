"use client";

import Link from "next/link";
import Image from "next/image";
import type { Team } from "@/lib/teams";

export default function BobbleheadMarker({ team }: { team: Team }) {
  const labelSide = team.labelSide ?? "right";

  return (
    <Link
      href={`/teams/${team.slug}`}
      className="group absolute z-0 hover:z-20 focus:z-20 -translate-x-1/2 -translate-y-full outline-none"
      style={{ left: `${team.x}%`, top: `${team.y}%` }}
      aria-label={`${team.city} ${team.name} bobblehead checklist`}
    >
      {/* tooltip */}
      <div
        className={`pointer-events-none absolute top-1 flex items-center gap-1.5 whitespace-nowrap rounded-md border-2 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-50 opacity-0 shadow-lg transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${
          labelSide === "left" ? "right-full mr-2" : "left-full ml-2"
        }`}
        style={{
          backgroundColor: "#1a1a2e",
          borderColor: team.secondary,
        }}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: team.primary }} />
        {team.name}
        <span className="font-normal normal-case text-amber-100/60">{team.city}</span>
      </div>

      {/* bobblehead figure */}
      <div className="relative h-[62px] w-[27px] origin-bottom transition-transform duration-150 group-hover:scale-110 sm:h-[78px] sm:w-[34px]">
        <div className="absolute inset-x-0 bottom-0 h-full origin-bottom group-hover:animate-bobble">
          <Image
            src={`/bobbleheads/${team.slug}.png`}
            alt=""
            fill
            sizes="80px"
            className="object-contain object-bottom drop-shadow-[0_3px_4px_rgba(0,0,0,0.6)]"
          />
        </div>
      </div>
    </Link>
  );
}
