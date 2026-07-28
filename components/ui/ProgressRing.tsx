/* Small SVG completion ring. Pass percent 0–100, or null while the underlying
   ownership data is still loading (renders an empty ring with an em dash so
   unknown never masquerades as 0%). */
export function ProgressRing({
  percent,
  size = 56,
  strokeWidth = 5,
  className,
}: {
  percent: number | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <span className={`relative inline-block ${className ?? ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-soft)"
          strokeWidth={strokeWidth}
        />
        {percent != null ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-500"
          />
        ) : null}
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-bold text-navy">
        {percent == null ? "—" : `${Math.round(clamped)}%`}
      </span>
    </span>
  );
}
