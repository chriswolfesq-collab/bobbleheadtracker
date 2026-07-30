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

/* The shelf geometry, in one place. Every wall that renders planks — the teams
   page, the profile display case, the public shelf, the share card — pulls these
   so the shelves read as the same furniture instead of drifting apart. All steps
   are container queries keyed to the wall's own width, not the viewport's, so
   the fixed-width share card renders like a desktop shelf even when it is
   captured from a phone. */
export const SHELF_PLANK_CLASS = "h-8 @min-[520px]:h-11 @min-[760px]:h-14";
export const SHELF_FIGURE_CLASS = "h-18 @min-[520px]:h-28 @min-[760px]:h-36";
/** Matching `sizes` for the figure art, so the wide steps aren't upscaled. */
export const SHELF_FIGURE_SIZES = "(max-width: 640px) 20vw, 140px";
export const SHELF_PLATE_SIZE =
  "px-1 py-[2px] text-[8px] tracking-wide @min-[520px]:px-2 @min-[520px]:py-[3px] @min-[520px]:text-[10px] @min-[760px]:px-3 @min-[760px]:py-1 @min-[760px]:text-xs @min-[760px]:tracking-widest";
export const SHELF_PLAQUE_SIZE =
  "px-2.5 py-[2px] text-[10px] @min-[520px]:px-3 @min-[520px]:py-1 @min-[520px]:text-xs @min-[760px]:px-4 @min-[760px]:text-sm";

/**
 * The parchment wall the planks hang on. Wraps its own `@container` around the
 * wall so the wall's gap and padding can step with its width too: a `@min-[]`
 * class sitting on the same element that declares `@container` queries the
 * nearest ANCESTOR container, so without this outer div those steps silently
 * never match.
 */
export function ShelfWall({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`@container ${className ?? ""}`}>
      <div className="shelf-wall @container flex w-full flex-col gap-10 px-2 pb-10 pt-12 @min-[520px]:gap-14 @min-[520px]:px-4">
        {children}
      </div>
    </div>
  );
}

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
  plankClassName = SHELF_PLANK_CLASS,
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
          // Every shelf on the page shares this one URL, so this is a single
          // request, and the top shelves are above the fold — left lazy, the
          // wall paints bare and the planks pop in under the figures.
          loading="eager"
          // box-shadow, not drop-shadow: the plank art is an opaque JPEG
          // rectangle, so a drop-shadow blurs a *rectangle* and its faint edges
          // stick out past both ends of the plank, reading as a square outline
          // on the parchment. The negative spread pulls the shadow inside the
          // plank's own box so only the soft edge under the bottom lip escapes.
          className={`w-full object-fill shadow-[0_9px_10px_-6px_rgba(90,58,34,0.45)] ${plankClassName}`}
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
