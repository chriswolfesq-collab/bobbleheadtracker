"use client";

import Link from "next/link";
import { MessageMemberButton } from "@/components/MessageMemberButton";
import PublicGallery from "@/components/PublicGallery";
import { useAuth } from "@/lib/auth";
import { useFriendShelf } from "@/lib/friends";

// The friendship strip on a public /shelf/<slug> page: the ask/accept button,
// and — once friends — the full shelf (every owned bobblehead, favorites, and
// the wanted list). A client island under the server-rendered summary because
// this site's sessions live in the browser: the server can't know who's
// looking, so anything viewer-specific has to hydrate in.
//
// Messaging lives here too, for that reason and one more: this component already
// resolves "is this my own shelf" (status 'self' renders nothing), so a Message
// button placed here cannot offer to message yourself. It sits beside the friend
// controls without depending on them — asking someone about a bobblehead on their
// shelf shouldn't require being their friend first.
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
            <div className="mt-4 flex justify-center">
              <MessageMemberButton
                slug={slug}
                displayName={displayName}
                buttonClassName={quietButtonClass}
              />
            </div>
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
          {/* Accepting is the moment consent is given, so this says what it
              actually grants rather than the reassuring version. Friends see
              items whenever EITHER visibility switch is on, and the friends one
              is on unless someone turned it off — so for a shelf that's private
              to the public, accepting is what opens it. Understating that here
              would be the one place it really matters. */}
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-zinc-600">
            {status === "pending_in"
              ? "Accept and you'll each see the other's bobbleheads, favorites and wanted list — including the items your shelf keeps private from everyone else. Either of you can turn that off in settings."
              : "Friends see each other's bobbleheads, favorites and wanted lists rather than just the totals — including items a shelf keeps private from the public. It goes both ways, and either of you can turn it off in settings."}
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
            <MessageMemberButton
              slug={slug}
              displayName={displayName}
              buttonClassName={quietButtonClass}
            />
          </div>
        </div>
      )}
    </div>
  );
}
