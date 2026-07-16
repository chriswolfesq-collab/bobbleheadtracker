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
          ? "border-amber-400 bg-amber-400/15 text-amber-300"
          : "border-white/15 bg-[#07111d] text-zinc-300 hover:border-amber-400/60 hover:text-amber-300"
      }`}
    >
      {label}
    </button>
  );
}
