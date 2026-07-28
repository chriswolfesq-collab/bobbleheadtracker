"use client";

import { useAuth } from "@/lib/auth";

export function WantedButton({
  isWanted,
  isLoggedIn,
  onToggle,
  className = "",
  itemLabel,
}: {
  isWanted: boolean;
  isLoggedIn: boolean;
  onToggle: () => void;
  className?: string;
  /** name of the item, so screen readers can tell the 100 cards apart */
  itemLabel?: string;
}) {
  const { openAuthModal } = useAuth();
  const subject = itemLabel ? ` ${itemLabel}` : "";
  const label = isLoggedIn
    ? isWanted
      ? `Remove${subject} from wanted`
      : `Add${subject} to wanted`
    : "Sign in to add to wanted";

  return (
    <button
      type="button"
      aria-pressed={isWanted}
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
        isWanted
          ? "border-accent bg-accent/20 text-accent"
          : "border-zinc-400/80 bg-white/80 text-zinc-700 hover:border-accent hover:text-accent-hover"
      } ${className}`}
    >
      <span aria-hidden>{isWanted ? "★" : "☆"}</span>
    </button>
  );
}
