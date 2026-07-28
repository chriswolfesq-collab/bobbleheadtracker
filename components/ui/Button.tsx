import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "solid" | "outline" | "brass";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  solid:
    "bg-accent text-accent-fg border border-accent hover:bg-accent-hover hover:border-accent-hover",
  outline:
    "border border-accent text-accent bg-transparent hover:bg-accent hover:text-accent-fg",
  brass: "brass-plate border border-brass text-navy-deep hover:brightness-105",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3 text-base",
};

function classes(variant: Variant, size: Size, className?: string) {
  return `inline-flex items-center justify-center gap-2 rounded font-display font-semibold uppercase tracking-wider transition disabled:pointer-events-none disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className ?? ""}`;
}

export function Button({
  variant = "solid",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" {...props} className={classes(variant, size, className)} />;
}

export function ButtonLink({
  variant = "solid",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <Link {...props} className={classes(variant, size, className)}>
      {children}
    </Link>
  );
}
