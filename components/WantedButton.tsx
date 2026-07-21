"use client";

import { useAuth } from "@/lib/auth";

export function WantedButton({
  isWanted,
  isLoggedIn,
  onToggle,
  className = "",
}: {
  isWanted: boolean;
  isLoggedIn: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { openAuthModal } = useAuth();

  return (
    <button
      type="button"
      aria-pressed={isWanted}
      aria-label={isLoggedIn ? (isWanted ? "Remove from wanted" : "Add to wanted") : "Sign in to add to wanted"}
      title={isLoggedIn ? (isWanted ? "Remove from wanted" : "Add to wanted") : "Sign in to add to wanted"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isLoggedIn) {
          openAuthModal("sign-in");
          return;
        }
        onToggle();
      }}
      className={`grid place-items-center rounded-full border transition ${
        isWanted
          ? "border-red-400 bg-red-400/20 text-red-400"
          : "border-zinc-300/80 bg-[#0a1522]/80 text-zinc-300 hover:border-red-400 hover:text-red-400"
      } ${className}`}
    >
      <span aria-hidden>{isWanted ? "♥" : "♡"}</span>
    </button>
  );
}
