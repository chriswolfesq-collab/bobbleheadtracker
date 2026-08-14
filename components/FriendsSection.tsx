"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { avatarPublicUrl } from "@/lib/avatar";
import { sendFriendRequest, type Friendship, type useFriendships } from "@/lib/friends";

// The Friends tab: add by shelf link, answer what's waiting, see who you've
// got. Prop-driven from the shell's single useFriendships() call so the tab
// pill's count and these lists can never disagree.

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

/** Pulls the slug out of whatever got pasted: a bare slug, a full shelf URL,
 *  or a URL with trailing slash or query noise. */
function slugFromInput(raw: string): string {
  const trimmed = raw.trim();
  const afterShelf = trimmed.includes("/shelf/")
    ? (trimmed.split("/shelf/")[1] ?? "")
    : trimmed;
  return afterShelf.split(/[/?#]/)[0]?.trim() ?? "";
}

const SENT_MESSAGES: Record<string, string> = {
  pending: "Request sent. They'll see it on their profile.",
  accepted: "They'd already asked you — you're friends now!",
  already_pending: "You've already asked — still waiting on them.",
  already_friends: "You're already friends.",
};

export function FriendsSection({
  friendships,
}: {
  friendships: ReturnType<typeof useFriendships>;
}) {
  const { friends, incoming, outgoing, isLoading, respond, cancel, remove, refresh } = friendships;
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border-soft bg-surface p-5">
        <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
          Add a Friend
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-700">
          Friends see each other&rsquo;s wanted lists, and each other&rsquo;s individual
          bobbleheads as far as each of you has turned on{" "}
          <Link href="/settings" className="font-semibold text-accent hover:underline">
            Show my items
          </Link>{" "}
          — rather than just the totals. Paste a collector&rsquo;s shelf link (or visit their shelf
          and tap <span className="font-semibold">Add friend</span> there).
        </p>
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const slug = slugFromInput(draft);
            if (!slug) return;
            setIsSending(true);
            setSendResult(null);
            try {
              const status = await sendFriendRequest(slug);
              setSendResult({ ok: true, message: SENT_MESSAGES[status] ?? "Request sent." });
              setDraft("");
              refresh();
            } catch (caught) {
              setSendResult({
                ok: false,
                message: caught instanceof Error ? caught.message : "Couldn't send that request.",
              });
            } finally {
              setIsSending(false);
            }
          }}
        >
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="bobbleshelf.com/shelf/…"
            className="w-72 max-w-full rounded border border-black/15 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={isSending || !slugFromInput(draft)}
            className="rounded bg-accent px-4 py-2 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
          >
            {isSending ? "Sending…" : "Send request"}
          </button>
        </form>
        {sendResult ? (
          <p
            className={`mt-2 text-xs font-semibold ${sendResult.ok ? "text-green-700" : "text-red-600"}`}
          >
            {sendResult.message}
          </p>
        ) : null}
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
            No friends yet. Get someone&rsquo;s shelf link and send a request above — or share
            yours and have them tap <span className="font-semibold">Add friend</span> on it.
          </p>
        ) : (
          <ul className="space-y-2">
            {friends.map((friendship) => (
              <FriendRow key={friendship.userId} friendship={friendship}>
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
