"use client";

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
  return (
    <button
      type="button"
      aria-pressed={isFavorited}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      title={isLoggedIn ? (isFavorited ? "Remove from favorites" : "Add to favorites") : "Log in to favorite"}
      disabled={!isLoggedIn}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={`grid place-items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
        isFavorited
          ? "border-red-400 bg-red-400/20 text-red-400"
          : "border-zinc-300/80 bg-[#0a1522]/80 text-zinc-300 hover:border-red-400 hover:text-red-400"
      } ${className}`}
    >
      <span aria-hidden>{isFavorited ? "♥" : "♡"}</span>
    </button>
  );
}
