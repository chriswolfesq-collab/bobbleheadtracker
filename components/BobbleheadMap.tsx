import Image from "next/image";
import { TEAMS } from "@/lib/teams";
import BobbleheadMarker from "./BobbleheadMarker";

export default function BobbleheadMap() {
  return (
    <div className="mx-auto w-full max-w-6xl p-3 sm:p-6">
      <div className="relative aspect-[1536/1024] w-full overflow-visible">
        <Image
          src="/map/usamap.png"
          alt="MLB Bobblehead Map"
          fill
          priority
          className="pointer-events-none select-none object-contain"
        />

        {TEAMS.map((team) => (
          <BobbleheadMarker key={team.slug} team={team} />
        ))}
      </div>
    </div>
  );
}
