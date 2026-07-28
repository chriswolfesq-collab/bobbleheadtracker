"use client";

export function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded border px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-accent bg-accent/15 text-accent"
          : "border-black/10 bg-white text-zinc-700 hover:border-accent/60 hover:text-accent-hover"
      }`}
    >
      {label}
    </button>
  );
}
