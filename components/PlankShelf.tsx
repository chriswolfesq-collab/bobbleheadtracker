import Image from "next/image";
import type { ReactNode } from "react";
import { publicAsset } from "@/lib/paths";

// One display shelf from the BobbleShelf case artwork: a photographed plank
// (public/shelf-plank-art.jpg, cropped from the display-case art with the
// baked-in brass plate patched out) with a five-slot grid of figures standing
// on it. Plates render on the plank's front face in the same five columns so
// each label lines up under its figure; an optional brass plaque hangs
// centered below the plank.
//
// Both grids share the same padding/gap so columns align. Figures overlap the
// plank's top face slightly (negative margin) so they read as standing ON the
// wood rather than floating behind it. The parent panel is expected to be a
// Tailwind @container (the `.shelf-wall` panels are) so the @min-[520px]
// steps track the panel, not the viewport — the fixed-width share card
// renders the same as a desktop profile.
const FRONT_FACE_TOP = "38%"; // where the plank's top face ends in the artwork
const SLOTS = 5;

// Filters can leave a division with fewer than five teams. The grid is fixed at
// five columns so every shelf's slots line up, so a short row is centered by
// padding it with empty columns on both sides rather than letting it hug the
// left edge.
function centered(items: ReactNode[]): ReactNode[] {
  if (items.length >= SLOTS) return items.slice(0, SLOTS);
  const before = Math.floor((SLOTS - items.length) / 2);
  const after = SLOTS - items.length - before;
  return [
    ...Array.from({ length: before }, () => null),
    ...items,
    ...Array.from({ length: after }, () => null),
  ];
}

export function PlankShelf({
  figures,
  plates,
  plaque,
  plankClassName = "h-9 @min-[520px]:h-11",
  ariaLabel,
}: {
  /** Up to five figure nodes, index-aligned with `plates`. */
  figures: ReactNode[];
  /** Label nodes pinned to the plank's front face, one per figure column. */
  plates: ReactNode[];
  /** Optional brass plaque hung under the plank's center (division name). */
  plaque?: ReactNode;
  plankClassName?: string;
  ariaLabel?: string;
}) {
  return (
    <section aria-label={ariaLabel}>
      <div className="relative z-10 -mb-3 grid grid-cols-5 items-end gap-x-[2%] px-[4%] @min-[520px]:-mb-4">
        {centered(figures).map((figure, index) => (
          <div key={index} className="flex min-w-0 justify-center">
            {figure}
          </div>
        ))}
      </div>
      <div className="relative">
        <Image
          src={publicAsset("/shelf-plank-art.jpg")}
          alt=""
          width={996}
          height={74}
          className={`w-full object-fill drop-shadow-[0_9px_9px_rgba(90,58,34,0.35)] ${plankClassName}`}
        />
        <div
          className="absolute inset-x-0 bottom-[8%] grid grid-cols-5 items-center gap-x-[2%] px-[4%]"
          style={{ top: FRONT_FACE_TOP }}
        >
          {centered(plates).map((plate, index) => (
            <div key={index} className="flex min-w-0 justify-center">
              {plate}
            </div>
          ))}
        </div>
      </div>
      {/* The plaque hangs off the plank's bottom edge. The overlap is keyed to
          the shelf's width because the plank (and the plate row on its front
          face) shrinks with it — a fixed offset rides up over the middle plate
          on a narrow shelf. */}
      {plaque ? (
        <div className="relative z-10 -mt-0.5 flex justify-center @min-[520px]:-mt-2.5">
          {plaque}
        </div>
      ) : null}
    </section>
  );
}
