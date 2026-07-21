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
          ? "border-accent bg-accent/20 text-accent"
          : "border-zinc-400/80 bg-white/80 text-zinc-700 hover:border-accent hover:text-accent-hover dark:border-zinc-300/80 dark:bg-[#0a1522]/80 dark:text-zinc-300"
      } ${className}`}
    >
      <span aria-hidden>{isWanted ? "★" : "☆"}</span>
    </button>
  );
}
