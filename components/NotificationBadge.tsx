/** The red count bubble that sits on the corner of a link or button.
 *
 *  Shared by the admin dashboard tiles and the header's Admin/Team rep button
 *  so "you have things waiting" looks the same wherever it's said. Renders
 *  nothing at zero, so callers can hand it a count unconditionally.
 *
 *  The offset and the ring are props rather than something to override through
 *  `className`: two competing Tailwind utilities for the same property resolve
 *  by stylesheet order, not by which one the caller wrote last. The ring is the
 *  backdrop colour — it punches a gap between the bubble and whatever it
 *  overlaps — so it has to change with the surface the badge is used on.
 */
export function NotificationBadge({
  count,
  offsetClass = "-right-2 -top-2",
  ringClass = "ring-slate-50",
  ...rest
}: {
  count: number;
  offsetClass?: string;
  ringClass?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  if (count <= 0) return null;

  return (
    <span
      {...rest}
      className={`absolute ${offsetClass} flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white ring-2 ${ringClass}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
