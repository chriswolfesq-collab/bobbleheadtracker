"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { avatarPublicUrl } from "@/lib/avatar";
import { MIN_MEMBER_QUERY, type MemberResult, type useMemberSearch } from "@/lib/friends";

// Finding collectors by name, inside the Friends tab. One input covers all three
// things a member might arrive with: a name, a shelf handle, or a pasted shelf
// link (memberQuery reduces the link to its slug, which the search matches).
//
// Prop-driven for the same reason the rest of the tab is — the hook lives in the
// section, so a request sent from here and the lists below it read one source of
// truth instead of two that can disagree.

/** What a row says when there's nothing to press. Only 'none' is actionable;
 *  the rest are statements, so they render as text rather than as a button that
 *  would do nothing. */
const STANDING: Record<Exclude<MemberResult["status"], "none">, string> = {
  friends: "Already friends",
  pending_out: "Request sent",
  pending_in: "They asked you — see below",
};

function MemberRow({
  member,
  onAsk,
}: {
  member: MemberResult;
  onAsk: (member: MemberResult) => Promise<string | null>;
}) {
  const [isSending, setIsSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <li className="flex items-center gap-3 rounded-lg border border-black/10 bg-white p-3">
      <Avatar
        name={member.displayName}
        url={avatarPublicUrl(member.avatarPath)}
        className="h-9 w-9 text-sm"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-zinc-900">{member.displayName}</p>
        <Link
          href={`/shelf/${member.slug}`}
          className="text-xs font-semibold text-accent underline-offset-2 hover:underline"
        >
          View shelf
        </Link>
        {failure ? <p className="mt-1 text-xs font-semibold text-red-600">{failure}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {member.status === "none" ? (
          <button
            type="button"
            disabled={isSending}
            onClick={async () => {
              setIsSending(true);
              setFailure(null);
              const message = await onAsk(member);
              // Success replaces this button with "Request sent", so only a
              // failure has to put the row back the way it was.
              if (message) {
                setFailure(message);
                setIsSending(false);
              }
            }}
            className="rounded bg-accent px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
          >
            {isSending ? "Sending…" : "Add friend"}
          </button>
        ) : (
          <span className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
            {STANDING[member.status]}
          </span>
        )}
      </div>
    </li>
  );
}

export function MemberSearch({ search }: { search: ReturnType<typeof useMemberSearch> }) {
  const { draft, setDraft, query, results, isSearching, hasSearched, error, ask } = search;
  // Typed, but too short for the search to run. Say that, rather than showing an
  // empty list that reads as "nobody by that name".
  const isTooShort = draft.trim().length > 0 && !query;

  return (
    <div>
      <label
        htmlFor="member-search"
        className="block text-xs font-black uppercase tracking-[0.2em] text-zinc-600"
      >
        Find a collector
      </label>
      <input
        id="member-search"
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Name, or a shelf link"
        autoComplete="off"
        className="mt-2 w-full max-w-md rounded border border-black/15 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-accent"
      />

      <div aria-live="polite" className="mt-3">
        {isTooShort ? (
          <p className="text-xs text-zinc-500">
            Keep typing — {MIN_MEMBER_QUERY} letters or more to search.
          </p>
        ) : error ? (
          <p className="text-xs font-semibold text-red-600">{error}</p>
        ) : isSearching ? (
          <p className="text-xs text-zinc-500">Searching…</p>
        ) : hasSearched && results.length === 0 ? (
          <p className="max-w-xl text-xs leading-5 text-zinc-600">
            No collectors match &ldquo;{query}&rdquo;. A name has to match how they signed up — if
            you have their shelf link, paste it here instead.
          </p>
        ) : results.length > 0 ? (
          <ul className="space-y-2">
            {results.map((member) => (
              <MemberRow key={member.userId} member={member} onAsk={ask} />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
