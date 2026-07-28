import Image from "next/image";
import type { ReactNode } from "react";
import { publicAsset } from "@/lib/paths";

// The lit display-case banner (public/case-banner.jpg): the case artwork with
// its baked-in title text and info card erased, so pages overlay their own
// live text in the cleared regions. The percentages locate those regions —
// TEXT_BOX is the parchment span between the BOBBLE SHELF block and the
// baseball, CARD_BOX is the cleared card recess on the right.
const TEXT_BOX = { left: "19%", top: "18%", width: "35%", height: "64%" };
const CARD_BOX = { left: "76.5%", top: "22%", width: "19.5%", height: "66%" };

// The case is too short on phones to hold real text, so below md the artwork
// is swapped for a plain surface card carrying the same content (`mobile`) —
// the same trade the homepage hero makes.
export function CaseBanner({
  overlay,
  card,
  mobile,
  preload = false,
}: {
  /** Title/subtitle content shown inside the case's cleared text region (md+). */
  overlay: ReactNode;
  /** Optional info card rendered in the cleared card recess (md+). */
  card?: ReactNode;
  /** Fallback content rendered as a plain card below md. */
  mobile: ReactNode;
  preload?: boolean;
}) {
  return (
    <section>
      <div className="flex flex-col items-start rounded-xl border border-border-soft bg-surface px-6 py-6 md:hidden">
        {mobile}
      </div>
      <div className="relative hidden overflow-hidden rounded-xl shadow-lg md:block">
        <Image
          src={publicAsset("/case-banner.jpg")}
          alt=""
          width={1007}
          height={205}
          preload={preload}
          sizes="(max-width: 1152px) 100vw, 1152px"
          className="h-auto w-full"
        />
        <div className="absolute flex flex-col items-start justify-center" style={TEXT_BOX}>
          {overlay}
        </div>
        {card ? (
          <div className="absolute flex items-center justify-center" style={CARD_BOX}>
            {card}
          </div>
        ) : null}
      </div>
    </section>
  );
}
