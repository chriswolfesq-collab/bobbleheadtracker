"use client";

import { useAuth } from "@/lib/auth";

export function FavoriteButton({
  isFavorited,
  isLoggedIn,
  onToggle,
  className = "",
}: {
  isFavorited: boolean;
  isLoggedIn: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { openAuthModal } = useAuth();

  return (
    <button
      type="button"
      aria-pressed={isFavorited}
      aria-label={isLoggedIn ? (isFavorited ? "Remove from favorites" : "Add to favorites") : "Sign in to favorite"}
      title={isLoggedIn ? (isFavorited ? "Remove from favorites" : "Add to favorites") : "Sign in to favorite"}
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
        isFavorited
          ? "border-red-400 bg-red-400/20 text-red-400"
          : "border-zinc-400/80 bg-white/80 text-zinc-700 hover:border-red-400 hover:text-red-400 dark:border-zinc-300/80 dark:bg-[#0a1522]/80 dark:text-zinc-300"
      } ${className}`}
    >
      <span aria-hidden>{isFavorited ? "♥" : "♡"}</span>
    </button>
  );
}
