"use client";

import { useTheme, type ThemePreference } from "@/lib/theme";

// Settings control for the app-wide light/dark preference. Matches the card
// shape of the other settings toggles (ShelfSharingToggle / GalleryToggle),
// but presents three choices as a segmented control instead of a switch,
// since "System" is a distinct state from either forced theme.
const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="mb-8 rounded-2xl border border-black/10 bg-black/[0.04] p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600 dark:text-zinc-400">
            Appearance
          </h2>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            Choose a light or dark look, or follow your device setting.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Appearance"
          className="flex flex-shrink-0 rounded-full border border-black/10 bg-black/[0.04] p-0.5 dark:border-white/10 dark:bg-black/20"
        >
          {OPTIONS.map((option) => {
            const active = preference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPreference(option.value)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-accent text-accent-fg shadow"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
