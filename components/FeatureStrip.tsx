/* The four-feature icon strip shared by the homepage and /teams. */
const FEATURES = [
  {
    title: "Complete Database",
    blurb: "Thousands of bobbleheads from every MLB team.",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
      </svg>
    ),
  },
  {
    title: "Built by the Community",
    blurb: "Add photos, updates and share your collection.",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "Track Your Collection",
    blurb: "Mark off the ones you own and see your progress.",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12.5l2.5 2.5L16 9" />
      </svg>
    ),
  },
  {
    title: "Stay Up to Date",
    blurb: "Get the latest releases and rare finds.",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
        <path d="M12 2l2.9 6.26L21.5 9.27l-5 4.87 1.18 6.88L12 17.77l-5.68 3.25L7.5 14.14l-5-4.87 6.6-1.01L12 2z" />
      </svg>
    ),
  },
];

export function FeatureStrip({ className }: { className?: string }) {
  return (
    <section
      className={`grid grid-cols-1 gap-x-4 gap-y-6 rounded-xl border border-border-soft bg-surface px-6 py-6 sm:grid-cols-2 lg:grid-cols-4 ${className ?? ""}`}
    >
      {FEATURES.map((feature) => (
        <div key={feature.title} className="flex items-start gap-3.5">
          <span className="shrink-0 text-navy">{feature.icon}</span>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-navy">
              {feature.title}
            </h3>
            <p className="mt-1 text-sm leading-5 text-zinc-600">{feature.blurb}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
