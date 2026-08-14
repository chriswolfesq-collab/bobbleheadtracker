import Image from "next/image";
import {
  PlankShelf,
  SHELF_FIGURE_CLASS,
  SHELF_FIGURE_SIZES,
  SHELF_PLAQUE_SIZE,
  SHELF_PLATE_SIZE,
  ShelfWall,
} from "@/components/PlankShelf";
import { NamePlate } from "@/components/ui/NamePlate";
import { type AwardFacts, type AwardState, evaluateAwards } from "@/lib/awards";
import { publicAsset } from "@/lib/paths";

// Five to a plank, same as the team shelves — the awards wall has to read as
// the same furniture as the display case hanging above it.
const SLOTS = 5;

/**
 * Splits a category across planks in balanced rows rather than filling each
 * plank before starting the next.
 *
 * Six awards laid out greedily give a full shelf and then a single trophy
 * marooned in the middle of an empty one; 3 + 3 reads as a set. Nine still come
 * out 5 + 4, because with two rows either way the fuller top shelf looks
 * deliberate.
 */
function intoRows<T>(items: T[]): T[][] {
  if (items.length <= SLOTS) return [items];
  const rowCount = Math.ceil(items.length / SLOTS);
  const perRow = Math.ceil(items.length / rowCount);
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += perRow) {
    rows.push(items.slice(index, index + perRow));
  }
  return rows;
}

/**
 * One trophy standing on the plank. Earned awards show in full colour; locked
 * ones are drained and dimmed exactly the way an unstarted team is on the
 * display case, so the two walls speak the same language.
 */
function AwardFigure({ award }: { award: AwardState }) {
  return (
    <div className="group relative flex flex-col items-center justify-end outline-none">
      {/* Tooltip carries the requirement and, for a locked award, how far off it
          is — the plate under the figure only has room for the name. Matches the
          display case's team tooltip. */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-amber-400/40 bg-[#101827]/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-50 opacity-0 shadow-xl transition-all duration-150 group-hover:opacity-100 sm:text-[11px]">
        {award.requirement}
        {award.earned ? null : (
          <span className="ml-1.5 font-normal normal-case text-amber-100/60">
            {award.progressLabel ?? "not yet"}
          </span>
        )}
      </div>

      {/* A rep award stands its own team's bobblehead on the shelf, so a
          Dodgers rep gets a Dodgers figure among the trophies rather than one
          more badge that differs only in its caption. Same art and sizing as
          the display case, so the two walls match. */}
      {award.teamSlug ? (
        <Image
          src={publicAsset(`/bobbleheads/${award.teamSlug}.png`)}
          alt=""
          width={677}
          height={1607}
          sizes={SHELF_FIGURE_SIZES}
          className={`w-auto origin-bottom drop-shadow-[0_5px_6px_rgba(0,0,0,0.5)] transition-transform duration-200 ease-out ${SHELF_FIGURE_CLASS} ${
            award.earned ? "group-hover:scale-[1.12]" : "opacity-25 grayscale"
          }`}
        />
      ) : (
        <span
          aria-hidden
          className={`flex items-end justify-center leading-none drop-shadow-[0_5px_6px_rgba(0,0,0,0.5)] transition-transform duration-200 ease-out ${SHELF_FIGURE_CLASS} text-[2rem] @min-[520px]:text-[3.25rem] @min-[760px]:text-[4.25rem] ${
            award.earned ? "group-hover:scale-[1.12]" : "opacity-25 grayscale"
          }`}
        >
          {award.icon}
        </span>
      )}

      {/* The figure and its plate are both decorative on their own; this is the
          one accessible statement of what the award is and whether it's won. */}
      <span className="sr-only">
        {award.name}, {award.requirement}.{" "}
        {award.earned ? "Earned." : `Not earned yet${award.progressLabel ? `, ${award.progressLabel}` : ""}.`}
      </span>
    </div>
  );
}

/**
 * The awards wall: trophies standing on the same photographed planks as the
 * bobblehead display case, one group of shelves per category.
 *
 * Locked awards are shown, not hidden, and that's the whole point: a member
 * with 30 bobbleheads is meant to see Half Century standing there greyed out.
 * Hiding what you haven't earned turns a ladder into a trophy case, and a
 * trophy case gives nobody a reason to come back. (The two categories nobody
 * can work toward — founding and rep — are the exception, and evaluateAwards
 * drops those rather than showing unwinnable grey plates.)
 *
 * Earned awards get a brass plate; locked ones get the navy plate dimmed. The
 * site already uses brass for the things worth engraving, so the wall reads
 * without a legend.
 */
export default function AwardsShelf({
  facts,
  isLoading = false,
  isOtherUser = false,
}: {
  facts: AwardFacts;
  /** Counts still loading. Renders the wall with nothing earned rather than
   *  flashing a full shelf that then empties out. */
  isLoading?: boolean;
  /** True on the public shelf and the admin view, so the summary line stops
   *  addressing the reader as the collection's owner. */
  isOtherUser?: boolean;
}) {
  const { categories, earnedCount, totalCount, next } = evaluateAwards(facts);

  return (
    <div className="@container">
      <div className="relative mx-auto w-full max-w-6xl px-4 @min-[520px]:px-6">
        <ShelfWall>
          {categories.flatMap((category) =>
            intoRows(category.awards).map((row, rowIndex, rows) => (
              <PlankShelf
                key={`${category.id}-${rowIndex}`}
                ariaLabel={`${category.label} awards`}
                figures={row.map((award) => (
                  <AwardFigure
                    key={award.id}
                    award={isLoading ? { ...award, earned: false } : award}
                  />
                ))}
                plates={row.map((award) => (
                  <NamePlate
                    key={award.id}
                    variant={!isLoading && award.earned ? "brass" : "navy"}
                    size={SHELF_PLATE_SIZE}
                    // Dimmed but still readable. A locked award you can't read
                    // is a locked award that can't motivate anyone — the name
                    // is the whole reason to show it rather than hide it.
                    className={isLoading || award.earned ? "" : "opacity-70"}
                  >
                    {award.name}
                  </NamePlate>
                ))}
                // Only under the last plank of a category, so a group that
                // spans two shelves reads as one section rather than as the
                // same heading twice.
                plaque={
                  rowIndex === rows.length - 1 ? (
                    <NamePlate variant="brass" size={SHELF_PLAQUE_SIZE}>
                      {category.plaque}
                      <span className="ml-2 tabular-nums opacity-70">
                        {isLoading ? "—" : `${category.earnedCount}/${category.awards.length}`}
                      </span>
                    </NamePlate>
                  ) : undefined
                }
              />
            )),
          )}
        </ShelfWall>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-4 @min-[520px]:px-6">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
          {isLoading ? "—" : `${earnedCount} of ${totalCount} awards`}
        </p>
        {!isLoading && next ? (
          <p className="text-xs font-bold text-zinc-500">
            <span aria-hidden className="mr-1.5">
              {next.award.icon}
            </span>
            {next.progressLabel} to{" "}
            <span className="font-black text-accent">{next.award.name}</span>
          </p>
        ) : null}
        {!isLoading && !next ? (
          <p className="text-xs font-bold text-zinc-500">
            <span aria-hidden className="mr-1.5">
              👑
            </span>
            {isOtherUser ? "Every award earned." : "You've earned every award."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
