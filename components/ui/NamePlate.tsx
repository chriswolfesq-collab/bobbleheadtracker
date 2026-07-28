import type { ReactNode } from "react";

/* Engraved plates used across the shelf treatments: navy plates carry team
   names under figures; brass plates carry division names and "EST." years. */
export function NamePlate({
  variant = "navy",
  className,
  children,
}: {
  variant?: "navy" | "brass";
  className?: string;
  children: ReactNode;
}) {
  if (variant === "brass") {
    return (
      <span
        className={`brass-plate inline-flex items-center justify-center rounded px-4 py-1 font-display text-sm font-bold uppercase tracking-widest text-navy-deep ${className ?? ""}`}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded bg-navy px-3 py-1 font-display text-xs font-bold uppercase tracking-widest text-accent-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_3px_rgba(0,0,0,0.35)] ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
