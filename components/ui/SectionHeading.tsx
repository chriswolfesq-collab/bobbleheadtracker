import Link from "next/link";

export function SectionHeading({
  eyebrow,
  title,
  viewAllHref,
  viewAllLabel = "View All",
  className,
}: {
  eyebrow?: string;
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-3 ${className ?? ""}`}>
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brass">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-navy">
          {title}
        </h2>
      </div>
      {viewAllHref ? (
        <Link
          href={viewAllHref}
          className="shrink-0 pb-0.5 text-sm font-semibold text-accent transition hover:text-accent-hover"
        >
          {viewAllLabel} <span aria-hidden>→</span>
        </Link>
      ) : null}
    </div>
  );
}
