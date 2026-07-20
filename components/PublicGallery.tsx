import Image from "next/image";
import Link from "next/link";
import type { PublicGalleryItem } from "@/lib/publicShelf";
import { publicAsset } from "@/lib/paths";
import { TEAMS } from "@/lib/teams";

// The opt-in browsable gallery shown below the shelf's counts on a public
// /shelf/<slug> page, when its owner has turned the gallery on (see
// supabase/gallery.sql). A plain server component: the items are resolved in
// getPublicGallery on the server, so there's nothing to hydrate. Splits the
// owner's items into what they own and what they've favorited, each a grid of
// cards linking through to the bobblehead.
function GalleryGrid({ items }: { items: PublicGalleryItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const team = TEAMS.find((t) => t.slug === item.teamSlug);
        const imageSrc = item.imageUrl ?? publicAsset(`/bobbleheads/${item.teamSlug}.png`);

        return (
          <Link
            key={`${item.teamSlug}:${item.bobbleheadId}`}
            href={item.href}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-center transition hover:border-amber-400/50 hover:bg-white/10"
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
              <span className="block truncate text-sm font-bold text-zinc-100">{item.title}</span>
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

export default function PublicGallery({
  displayName,
  items,
}: {
  displayName: string;
  items: PublicGalleryItem[];
}) {
  const owned = items.filter((item) => item.kind === "owned");
  const favorites = items.filter((item) => item.kind === "favorite");

  // getPublicGallery only returns items when the owner opted in, so the page
  // already guards on items.length; nothing to show if somehow both are empty.
  if (owned.length === 0 && favorites.length === 0) return null;

  return (
    <div className="mt-12 space-y-10">
      {owned.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">
              {displayName}&rsquo;s bobbleheads
            </h2>
            <span className="text-xs font-black tabular-nums text-amber-300">{owned.length}</span>
          </div>
          <GalleryGrid items={owned} />
        </section>
      ) : null}

      {favorites.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">
              Favorites
            </h2>
            <span className="text-xs font-black tabular-nums text-red-400">
              {favorites.length}
            </span>
          </div>
          <GalleryGrid items={favorites} />
        </section>
      ) : null}
    </div>
  );
}
