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
          ? "border-amber-400 bg-amber-400/20 text-amber-400"
          : "border-zinc-300/80 bg-[#0a1522]/80 text-zinc-300 hover:border-amber-400 hover:text-amber-400"
      } ${className}`}
    >
      <span aria-hidden>{isFavorited ? "★" : "☆"}</span>
    </button>
  );
}
