"use client";

import { useState } from "react";

// The one way a person is drawn anywhere on the site: their photo if they've
// set one, else their first initial in the accent circle the header button has
// always used. Sizing comes in through className (h-*/w-* plus a text size for
// the initial) because every caller wants a different diameter and Tailwind
// can't build class names at runtime.
//
// Decorative on purpose — alt="" and aria-hidden — since every place an avatar
// renders puts the person's name right next to it; a screen reader hearing the
// name twice is the only thing an alt text would add.
export function Avatar({
  name,
  url,
  className,
}: {
  name: string | null;
  url: string | null;
  className?: string;
}) {
  // A dead URL falls back to initials rather than the browser's broken-image
  // icon — same reasoning as BobbleheadImage's fallbackSrc: storage objects
  // get deleted out from under the rows that point at them. Compared during
  // render (the recycled-component pattern) so a list re-key gives the new
  // URL its own chance.
  const [failed, setFailed] = useState(false);
  const [prevUrl, setPrevUrl] = useState(url);
  if (prevUrl !== url) {
    setPrevUrl(url);
    setFailed(false);
  }

  if (url && !failed) {
    return (
      // Plain <img>, not next/image: these are 256px JPEGs of a few dozen KB,
      // already smaller than what the optimizer would return.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ${className ?? ""}`}
      />
    );
  }

  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-accent font-black text-accent-fg ${className ?? ""}`}
    >
      {initial}
    </span>
  );
}
