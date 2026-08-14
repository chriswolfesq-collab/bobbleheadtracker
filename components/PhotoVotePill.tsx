"use client";

import { useAuth } from "@/lib/auth";

// The vote control under each photo thumbnail. One member, one vote per
// listing: voting a different photo moves the vote, voting your current pick
// takes it back. Signed-out clicks open the auth modal (the FavoriteButton
// pattern) rather than rendering a dead button.
export function PhotoVotePill({
  votes,
  isMine,
  isLoggedIn,
  onToggle,
}: {
  votes: number;
  isMine: boolean;
  isLoggedIn: boolean;
  onToggle: () => void;
}) {
  const { openAuthModal } = useAuth();

  return (
    <button
      type="button"
      aria-pressed={isMine}
      title={
        isLoggedIn
          ? isMine
            ? "Take back your vote"
            : "Vote for this photo — the top-voted photo becomes the main photo"
          : "Sign in to vote for the best photo"
      }
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isLoggedIn) {
          openAuthModal("sign-in");
          return;
        }
        onToggle();
      }}
      className={`inline-flex min-w-12 items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black tabular-nums transition ${
        isMine
          ? "border-accent bg-accent text-accent-fg"
          : "border-border-soft bg-white text-zinc-600 hover:border-accent hover:text-accent-hover"
      }`}
    >
      <span aria-hidden>▲</span>
      {votes}
      <span className="sr-only">{votes === 1 ? "vote" : "votes"} for this photo</span>
    </button>
  );
}
