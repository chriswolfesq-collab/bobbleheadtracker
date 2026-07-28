"use client";

/* Underline tab row (ALL BOBBLEHEADS / I OWN / I NEED / WISHLIST). Purely
   presentational — selection state lives with the caller. */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 overflow-x-auto border-b border-border-soft ${className ?? ""}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 font-display text-sm font-semibold uppercase tracking-wider transition ${
              isActive
                ? "border-accent text-navy"
                : "border-transparent text-zinc-500 hover:text-navy"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
