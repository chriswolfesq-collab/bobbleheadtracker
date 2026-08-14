"use client";

import Link from "next/link";
import PublicGallery from "@/components/PublicGallery";
import { useAuth } from "@/lib/auth";
import { useFriendShelf } from "@/lib/friends";

// The friendship strip on a public /shelf/<slug> page: the ask/accept button,
// and — once friends — the full shelf (every owned bobblehead, favorites, and
// the wanted list). A client island under the server-rendered summary because
// this site's sessions live in the browser: the server can't know who's
// looking, so anything viewer-specific has to hydrate in.
export function FriendShelfPanel({
  slug,
  displayName,
  publicGalleryShown,
}: {
  slug: string;
  displayName: string;
  /** Whether the server already rendered the opt-in public gallery above —
   *  friends then only gain the wanted list, and re-rendering owned/favorites
   *  here would show every card twice. */
  publicGalleryShown: boolean;
}) {
  const { openAuthModal } = useAuth();
  const { status, items, isGalleryLoading, ownerSharesWithFriends, send, accept, cancel } =
    useFriendShelf(slug);

  if (status === "loading" || status === "self") return null;

  const buttonClass =
    "rounded-full bg-accent px-5 py-2.5 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover";
  const quietButtonClass =
    "rounded-full border border-black/15 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover";

  const friendItems = publicGalleryShown ? items.filter((item) => item.kind === "wanted") : items;

  return (
    <div className="mt-10">
      {status === "friends" ? (
        <>
          <div className="rounded-2xl border border-green-600/30 bg-green-50/60 p-5 text-center">
            <p className="text-sm font-black uppercase tracking-wide text-green-800">
              You and {displayName} are friends
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-zinc-600">
              Manage your friends from your{" "}
              <Link href="/profile/friends" className="font-semibold underline underline-offset-2">
                profile
              </Link>
              .
            </p>
          </div>
          {isGalleryLoading ? (
            <p className="mt-6 text-center text-sm text-zinc-600">Loading the full shelf…</p>
          ) : friendItems.length > 0 ? (
            // Same breakout width as the public gallery above, for the same
            // reason: the grid is a main event, not sidebar filler.
            <div className="relative left-1/2 w-[calc(100vw-1rem)] max-w-6xl -translate-x-1/2 px-2 sm:px-4">
              <PublicGallery displayName={displayName} items={friendItems} />
            </div>
          ) : !ownerSharesWithFriends ? (
            // The owner turned friends-only visibility off. Say so rather than
            // leaving an empty space under a banner about being friends — and
            // say it's theirs to change, since a friend request can't.
            <p className="mx-auto mt-6 max-w-md text-center text-sm leading-6 text-zinc-600">
              {displayName} keeps their individual bobbleheads private, friends included, so you
              see the totals above. That&rsquo;s a switch on their settings, not something a friend
              request unlocks.
            </p>
          ) : null}
        </>
      ) : (
        <div className="rounded-2xl border border-border-soft bg-surface p-6 text-center">
          <p className="text-lg font-black text-zinc-900">
            {status === "pending_in"
              ? `${displayName} wants to be friends`
              : `Friends see ${displayName}'s full shelf`}
          </p>
          {/* Deliberately conditional language: whether a friend actually sees
              the items depends on the owner's "Show my items" setting, which is
              off by default. Promising the full shelf outright would be a lie
              on most shelves. */}
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-zinc-600">
            {status === "pending_in"
              ? "Accept and you'll each see the other's wanted list, and their individual bobbleheads if they've turned on Show my items."
              : "Friends can see each other's individual bobbleheads and wanted lists, rather than just the totals — as far as each of you has turned on Show my items. It goes both ways."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {status === "signed-out" ? (
              <button type="button" onClick={() => openAuthModal("sign-in")} className={buttonClass}>
                Sign in to add a friend
              </button>
            ) : status === "none" ? (
              <button type="button" onClick={send} className={buttonClass}>
                Add friend
              </button>
            ) : status === "pending_out" ? (
              <>
                <span className="text-xs font-black uppercase tracking-wide text-zinc-500">
                  Request sent
                </span>
                <button type="button" onClick={cancel} className={quietButtonClass}>
                  Take it back
                </button>
              </>
            ) : (
              <button type="button" onClick={accept} className={buttonClass}>
                Accept friend request
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
