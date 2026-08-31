import Image from "next/image";
import Link from "next/link";
import type { PublicGalleryItem } from "@/lib/publicShelf";
import { publicAsset } from "@/lib/paths";
import { TEAMS } from "@/lib/teams";

// The opt-in browsable gallery shown below the shelf's counts on a public
// /shelf/<slug> page. Two switches feed it, each on its own: the gallery one
// (supabase/gallery.sql) for owned and favorites, the wanted-list one
// (supabase/public_wanted_list.sql) for what they're still after — so any of
// the three sections below can be the only one that renders. A plain server
// component: the items are resolved in getPublicGallery on the server, so
// there's nothing to hydrate.
export function GalleryGrid({ items }: { items: PublicGalleryItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => {
        const team = TEAMS.find((t) => t.slug === item.teamSlug);
        const imageSrc = item.imageUrl ?? publicAsset(`/bobbleheads/${item.teamSlug}.png`);

        return (
          <Link
            key={`${item.teamSlug}:${item.bobbleheadId}`}
            href={item.href}
            className="flex flex-col items-center gap-2 rounded-2xl border border-black/10 bg-black/[0.04] px-3 py-4 text-center transition hover:border-accent/50 hover:bg-black/[0.06]"
          >
            <Image
              src={imageSrc}
              alt=""
              width={677}
              height={1607}
              sizes="160px"
              className="h-28 w-auto flex-shrink-0 rounded object-cover drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)] sm:h-32"
            />
            <span className="block w-full min-w-0">
              <span className="block truncate text-sm font-bold text-zinc-900">{item.title}</span>
              <span className="block truncate text-xs text-zinc-500">
                {team?.name ?? item.teamSlug}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** How many wanted cards the shelf page shows before handing off to the full
 *  list. Only the wanted section is capped: what you own is bounded by what you
 *  physically have, but a wanted list is the one people mark exhaustively —
 *  every bobblehead they don't own — and the longest on the site is near a
 *  thousand items, which is a lot of shelf page for a section that exists to be
 *  skimmed. Five columns at the widest breakpoint, so this is a whole number of
 *  rows at every size. */
const WANTED_PREVIEW_LIMIT = 60;

export default function PublicGallery({
  displayName,
  items,
  wantedHref,
}: {
  displayName: string;
  items: PublicGalleryItem[];
  /** The shelf's full wanted list, when one is public. Given it, a long wanted
   *  section is cut to WANTED_PREVIEW_LIMIT and links onward; without it the
   *  section renders whole, which is what the friend-gated view does — those
   *  items aren't public, so there's no page to send anyone to. */
  wantedHref?: string;
}) {
  const owned = items.filter((item) => item.kind === "owned");
  const favorites = items.filter((item) => item.kind === "favorite");
  // Public when the owner turned the wanted-list switch on, and always present
  // in the friend-gated view (lib/friends.ts).
  const wanted = items.filter((item) => item.kind === "wanted");

  // getPublicGallery only returns items when the owner opted in, so the page
  // already guards on items.length; nothing to show if somehow all are empty.
  if (owned.length === 0 && favorites.length === 0 && wanted.length === 0) return null;

  // Null unless there's both somewhere to send people and something left to
  // see there — which also narrows the href for the Link below.
  const overflowHref =
    wantedHref && wanted.length > WANTED_PREVIEW_LIMIT ? wantedHref : null;
  const shownWanted = overflowHref ? wanted.slice(0, WANTED_PREVIEW_LIMIT) : wanted;

  return (
    <div className="mt-12 space-y-10">
      {owned.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
              {displayName}&rsquo;s bobbleheads
            </h2>
            <span className="text-xs font-black tabular-nums text-accent">{owned.length}</span>
          </div>
          <GalleryGrid items={owned} />
        </section>
      ) : null}

      {favorites.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
              Favorites
            </h2>
            <span className="text-xs font-black tabular-nums text-red-400">
              {favorites.length}
            </span>
          </div>
          <GalleryGrid items={favorites} />
        </section>
      ) : null}

      {wanted.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
                Wanted
              </h2>
              {/* The reason this list is worth publishing: whoever opened the
                  link may be standing in front of one of these deciding
                  whether to buy it, and half of them have never used the site.
                  Say what the section is for rather than making them infer it
                  from the heading. */}
              <p className="mt-1 text-xs text-zinc-500">
                Still hunting for these — {displayName} doesn&rsquo;t have them yet.
              </p>
            </div>
            <span className="text-xs font-black tabular-nums text-amber-500">{wanted.length}</span>
          </div>
          <GalleryGrid items={shownWanted} />
          {overflowHref ? (
            // The count in the header already says how many there are; this is
            // the way to the rest of them, and it's below the grid because
            // that's where someone runs out of cards and looks for more.
            <div className="mt-5 text-center">
              <Link
                href={overflowHref}
                className="inline-block rounded-full border border-black/15 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover"
              >
                See all {wanted.length} wanted
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
