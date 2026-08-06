"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/upcomingGiveaways";

// The countdown is the one thing on an upcoming card that goes stale sitting
// still. Both the homepage and /upcoming are prerendered and revalidated hourly,
// so the `now` baked into each is whenever that page last regenerated, on the
// server's clock, in the server's timezone. Two pages built either side of
// midnight disagree — which is how the homepage came to caption Jul 31 "today"
// while /upcoming captioned Aug 1 — and neither necessarily agrees with the
// reader's own date.
//
// The server's answer still renders first so hydration has something stable to
// match; the effect then recomputes it against the browser's clock, which is the
// only clock that knows what "today" means to the person reading.
export function UpcomingCountdown({
  time,
  now,
  className,
}: {
  time: number;
  /** The server clock the surrounding list was selected against. */
  now: number;
  className?: string;
}) {
  const [label, setLabel] = useState(() => formatCountdown(time, now));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabel(formatCountdown(time, Date.now()));
  }, [time]);

  if (!label) return null;

  return <span className={className}>{label}</span>;
}
