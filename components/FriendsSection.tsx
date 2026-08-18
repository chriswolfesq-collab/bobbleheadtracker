"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { MessageMemberButton } from "@/components/MessageMemberButton";
import { MemberSearch } from "@/components/MemberSearch";
import { avatarPublicUrl } from "@/lib/avatar";
import { useMemberSearch, type Friendship, type useFriendships } from "@/lib/friends";

// The Friends tab: find someone, answer what's waiting, see who you've got.
// Prop-driven from the shell's single useFriendships() call so the tab pill's
// count and these lists can never disagree.
//
// Adding used to be a bare "paste a shelf link" box, because a link was the only
// way to find anyone. MemberSearch supersedes that box rather than sitting next
// to it: the search matches slugs too, so a pasted link still resolves — it just
// shows you whose shelf it is, name and avatar, before you ask.

const actionClass =
  "rounded border border-black/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-zinc-600 transition hover:border-accent hover:text-accent-hover";

function FriendRow({
  friendship,
  children,
}: {
  friendship: Friendship;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-black/10 bg-white p-3">
      <Avatar
        name={friendship.displayName}
        url={avatarPublicUrl(friendship.avatarPath)}
        className="h-9 w-9 text-sm"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-zinc-900">{friendship.displayName}</p>
        {friendship.slug ? (
          <Link
            href={`/shelf/${friendship.slug}`}
            className="text-xs font-semibold text-accent underline-offset-2 hover:underline"
          >
            View shelf
          </Link>
        ) : (
          <p className="text-xs text-zinc-400">No shelf yet</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </li>
  );
}

export function FriendsSection({
  friendships,
}: {
  friendships: ReturnType<typeof useFriendships>;
}) {
  const { friends, incoming, outgoing, isLoading, respond, cancel, remove, refresh } = friendships;
  const search = useMemberSearch(refresh);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border-soft bg-surface p-5">
        <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
          Add a Friend
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-700">
          Friends see each other&rsquo;s bobbleheads, favorites and wanted lists rather than just
          the totals — including items a shelf keeps private from the public. It goes both ways,
          and you can turn off what friends see under{" "}
          <Link href="/settings" className="font-semibold text-accent hover:underline">
            Show my friends more
          </Link>
          . Search for a collector by name below, paste their shelf link, or visit their shelf
          and tap <span className="font-semibold">Add friend</span> there.
        </p>
        <div className="mt-4">
          <MemberSearch search={search} />
        </div>
      </section>

      {incoming.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
            Waiting on You
          </h2>
          <ul className="space-y-2">
            {incoming.map((friendship) => (
              <FriendRow key={friendship.userId} friendship={friendship}>
                <button
                  type="button"
                  onClick={() => respond(friendship.userId, true)}
                  className="rounded bg-accent px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => respond(friendship.userId, false)}
                  className={actionClass}
                >
                  Decline
                </button>
              </FriendRow>
            ))}
          </ul>
        </section>
      ) : null}

      {outgoing.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
            Waiting on Them
          </h2>
          <ul className="space-y-2">
            {outgoing.map((friendship) => (
              <FriendRow key={friendship.userId} friendship={friendship}>
                <button
                  type="button"
                  onClick={() => cancel(friendship.userId)}
                  className={actionClass}
                >
                  Cancel request
                </button>
              </FriendRow>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
          Friends{friends.length > 0 ? ` · ${friends.length}` : ""}
        </h2>
        {isLoading ? (
          <p className="text-sm text-zinc-600">Loading…</p>
        ) : friends.length === 0 ? (
          <p className="max-w-xl text-sm leading-6 text-zinc-600">
            No friends yet. Search for a collector by name above — or share your shelf link and
            have them tap <span className="font-semibold">Add friend</span> on it.
          </p>
        ) : (
          <ul className="space-y-2">
            {friends.map((friendship) => (
              <FriendRow key={friendship.userId} friendship={friendship}>
                {/* Only accepted friends get this here; a pending request's row is
                    about answering the request, and messaging is reachable from
                    search anyway. A friend with no slug is unaddressable. */}
                {friendship.slug ? (
                  <MessageMemberButton
                    slug={friendship.slug}
                    displayName={friendship.displayName}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(friendship.userId)}
                  title="Remove this friend — you can always ask again later"
                  className={actionClass}
                >
                  Remove
                </button>
              </FriendRow>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
