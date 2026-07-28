import Image from "next/image";
import Link from "next/link";
import { NamePlate } from "@/components/ui/NamePlate";
import { publicAsset } from "@/lib/paths";
import type { Team } from "@/lib/teams";

/* A team tile: bobblehead figure standing on a mini wood shelf with a navy
   nameplate. Used in the homepage "Browse by Team" row and grids. */
export function TeamCard({
  team,
  eager,
  className,
}: {
  team: Team;
  eager?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={`/teams/${team.slug}`}
      className={`group flex snap-start flex-col items-center rounded-xl border border-border-soft bg-surface px-3 pb-3 pt-4 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className ?? ""}`}
    >
      <span className="wood-shelf flex w-full items-end justify-center px-2">
        <Image
          src={publicAsset(`/bobbleheads/${team.slug}.png`)}
          alt={`${team.city} ${team.name} bobblehead`}
          width={135}
          height={321}
          loading={eager ? "eager" : "lazy"}
          className="h-28 w-auto object-contain drop-shadow-[0_6px_6px_rgba(58,36,18,0.35)] transition group-hover:animate-bobble"
        />
      </span>
      <NamePlate className="mt-3 w-full max-w-[9rem] truncate">{team.name}</NamePlate>
    </Link>
  );
}
