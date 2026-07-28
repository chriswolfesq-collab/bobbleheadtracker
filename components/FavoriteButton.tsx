"use client";

import { useAuth } from "@/lib/auth";

export function FavoriteButton({
  isFavorited,
  isLoggedIn,
  onToggle,
  className = "",
  itemLabel,
}: {
  isFavorited: boolean;
  isLoggedIn: boolean;
  onToggle: () => void;
  className?: string;
  /** name of the item, so screen readers can tell the 100 cards apart */
  itemLabel?: string;
}) {
  const { openAuthModal } = useAuth();
  const subject = itemLabel ? ` ${itemLabel}` : "";
  const label = isLoggedIn
    ? isFavorited
      ? `Remove${subject} from favorites`
      : `Add${subject} to favorites`
    : "Sign in to favorite";

  return (
    <button
      type="button"
      aria-pressed={isFavorited}
      aria-label={label}
      title={label}
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
          : "border-zinc-400/80 bg-white/80 text-zinc-700 hover:border-red-400 hover:text-red-400"
      } ${className}`}
    >
      <span aria-hidden>{isFavorited ? "♥" : "♡"}</span>
    </button>
  );
}
