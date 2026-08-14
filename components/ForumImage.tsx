"use client";

import { useEffect, useState } from "react";
import { forumImageSignedUrl } from "@/lib/forumImages";
import { useDialog } from "@/lib/useDialog";

// A post's attached image: resolves the private storage path to a signed URL,
// shows an inline preview, and enlarges on click. Plain <img> throughout —
// deliberately not next/image or PhotoLightbox, whose optimizer path would
// hand a *private* signed URL to the Vercel optimizer and cache the result
// outside the board.
export function ForumImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  // Reset during render rather than in the effect (the recycled-component
  // pattern BobbleheadImage uses), so a re-keyed list never paints the old
  // image under the new path — and the effect stays free of sync setState.
  const [prevPath, setPrevPath] = useState(path);
  if (prevPath !== path) {
    setPrevPath(path);
    setUrl(null);
    setFailed(false);
  }

  useEffect(() => {
    let cancelled = false;
    forumImageSignedUrl(path).then((signed) => {
      if (cancelled) return;
      if (signed) setUrl(signed);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (failed) {
    // The row says an image exists but it can't be fetched (deleted file,
    // expired session). Say so quietly rather than rendering a broken icon.
    return <p className="mt-2 text-xs italic text-zinc-400">Image unavailable</p>;
  }

  if (!url) {
    return (
      <span
        aria-hidden
        className="mt-2 block h-40 w-56 max-w-full animate-pulse rounded border border-black/10 bg-black/[0.06]"
      />
    );
  }

  return (
    <>
      <button
        type="button"
        title="Click to enlarge"
        onClick={() => setIsZoomed(true)}
        className="mt-2 block cursor-zoom-in"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          onError={() => setFailed(true)}
          className="max-h-80 max-w-full rounded border border-black/10 object-contain"
        />
      </button>

      {isZoomed ? <Zoom url={url} alt={alt} onClose={() => setIsZoomed(false)} /> : null}
    </>
  );
}

function Zoom({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  const panelRef = useDialog<HTMLDivElement>(true, onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Enlarged image"
        className="relative flex max-h-full max-w-5xl flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className="min-h-0 max-w-full flex-1 rounded object-contain" />
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-white/40 px-4 py-1.5 text-xs font-black uppercase tracking-wide text-white transition hover:border-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
