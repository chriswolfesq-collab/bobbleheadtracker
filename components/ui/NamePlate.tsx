import type { ReactNode } from "react";

/* Engraved plates used across the shelf treatments: navy plates carry team
   names under figures; brass plates carry division names and "EST." years. */

const DEFAULT_SIZE = {
  navy: "px-3 py-1 text-xs",
  brass: "px-4 py-1 text-sm",
};

export function NamePlate({
  variant = "navy",
  size,
  className,
  children,
}: {
  variant?: "navy" | "brass";
  /** Padding + font-size utilities replacing the default ones. Shelves that pack
   *  five plates into one plank pass container-query sizes so the plates shrink
   *  with the shelf instead of overrunning their neighbours. */
  size?: string;
  className?: string;
  children: ReactNode;
}) {
  if (variant === "brass") {
    return (
      <span
        className={`brass-plate inline-flex items-center justify-center rounded font-display font-bold uppercase tracking-widest text-navy-deep ${size ?? DEFAULT_SIZE.brass} ${className ?? ""}`}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded bg-navy font-display font-bold uppercase tracking-widest text-accent-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_3px_rgba(0,0,0,0.35)] ${size ?? DEFAULT_SIZE.navy} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
