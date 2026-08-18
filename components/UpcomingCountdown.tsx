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
// So the label the server already rendered arrives as a prop and is used
// verbatim for the first render. Recomputing it here instead — even from the
// same `now` the server used — is what caused React #418 on every load: the
// reader's zone decides which calendar day an instant falls in, so the two sides
// reached different answers from identical inputs and React threw the whole tree
// away and rebuilt it. A string that was already decided can't disagree with
// itself.
//
// The effect then recomputes against the browser's clock, which is the only one
// that knows what "today" means to the person reading. That runs after
// hydration, so it's an ordinary update rather than a mismatch.
export function UpcomingCountdown({
  time,
  label: serverLabel,
  className,
}: {
  time: number;
  /** What the server rendered, so the first client render matches it exactly. */
  label: string;
  className?: string;
}) {
  const [label, setLabel] = useState(serverLabel);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabel(formatCountdown(time, Date.now()));
  }, [time]);

  if (!label) return null;

  return <span className={className}>{label}</span>;
}
