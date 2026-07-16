"use client";

import { toCanvas } from "html-to-image";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import DisplayCase from "@/components/DisplayCase";

export type ShareStats = {
  totalOwned: number;
  siteTotal: number;
  pctComplete: number;
  teamsStarted: number;
  teamCount: number;
};

// The card is captured at a fixed width so the shared image looks the same
// whether it was made on a phone or a desktop. DisplayCase sizes its labels off
// its own width (container queries), so this width is what drives their layout.
const CARD_WIDTH = 800;

/** Resolves once every <img> in the node has loaded, so nothing captures blank. */
async function waitForImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            // A broken image shouldn't hang the share.
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ShareCollectionButton({
  displayName,
  countByTeamSlug,
  totalByTeamSlug,
  stats,
}: {
  displayName: string;
  countByTeamSlug: Record<string, number>;
  totalByTeamSlug: Record<string, number>;
  stats: ShareStats;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleShare() {
    if (isBusy) return;
    setIsBusy(true);
    setStatus(null);

    let blob: Blob | null = null;
    try {
      // flushSync so the card is in the DOM and cardRef is populated before we
      // read it, rather than waiting for the next render tick.
      flushSync(() => setIsMounted(true));
      const node = cardRef.current;
      if (!node) throw new Error("share card did not mount");

      await waitForImages(node);
      await document.fonts?.ready;

      // toCanvas rather than toBlob so the result can be encoded as JPEG: the
      // shelf is photographic and the PNG toBlob returns runs ~2.8MB, which is a
      // lot to push through a share sheet on a phone.
      const canvas = await toCanvas(node, {
        pixelRatio: 2,
        backgroundColor: "#0e1626",
        width: CARD_WIDTH,
        // Required, not an optimisation: html-to-image caches fetched images by
        // URL with the query string stripped. Every next/image src is
        // "/_next/image?url=...&w=...", so without this all 31 images share the
        // cache key "/_next/image" and the whole card renders with whichever
        // image happened to load first.
        includeQueryParams: true,
      });
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
    } catch (error) {
      console.error("Failed to render share image", error);
    } finally {
      setIsMounted(false);
    }

    if (!blob) {
      setStatus("Couldn't build the image. Try again.");
      setIsBusy(false);
      return;
    }

    const siteUrl = window.location.origin;
    const file = new File([blob], "bobblehead-shelf.jpg", { type: "image/jpeg" });
    // The link rides in `text` rather than `url`: when a file is attached, several
    // targets drop the `url` field, and this way the link always travels with it.
    const text = `${displayName}'s MLB bobblehead shelf — ${stats.totalOwned}/${stats.siteTotal} owned (${stats.pctComplete}%). Track yours at ${siteUrl}`;

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "My MLB bobblehead shelf", text });
        setIsBusy(false);
        return;
      } catch (error) {
        // The user backing out of the share sheet is not a failure.
        if ((error as Error)?.name === "AbortError") {
          setIsBusy(false);
          return;
        }
        console.error("Share sheet failed, falling back to download", error);
      }
    }

    // No file sharing here (desktop Firefox, most desktop browsers): save the
    // image and put the link on the clipboard so both halves are still to hand.
    downloadBlob(blob, "bobblehead-shelf.jpg");
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Image saved and link copied to your clipboard.");
    } catch {
      setStatus("Image saved to your downloads.");
    }
    setIsBusy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        disabled={isBusy}
        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-zinc-300 transition hover:border-amber-400 hover:text-amber-300 disabled:opacity-60"
      >
        <span aria-hidden>↗</span>
        {isBusy ? "Preparing…" : "Share"}
      </button>
      {status ? <p className="mt-2 text-xs font-semibold text-zinc-400">{status}</p> : null}

      {/* Mounted only while capturing. The wrapper collapses to nothing so the card
          never appears on the page, while the card itself keeps normal static
          layout at CARD_WIDTH — html-to-image copies computed styles, so an
          offscreen transform or opacity here would end up baked into the PNG. */}
      {isMounted ? (
        <div aria-hidden style={{ height: 0, overflow: "hidden" }}>
          <div
            ref={cardRef}
            style={{
              width: CARD_WIDTH,
              background:
                "radial-gradient(ellipse 80% 50% at 50% -10%, #1b2a4a 0%, #0e1626 45%, #090e1a 100%)",
            }}
            className="pb-4 pt-6"
          >
            <div className="px-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-500/80">
                MLB Bobblehead Shelf
              </p>
              <p className="mt-1 text-3xl font-black text-white">{displayName}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${stats.pctComplete}%` }}
                />
              </div>
              <p className="mt-2 text-xs font-bold text-zinc-400">
                {stats.totalOwned}/{stats.siteTotal} owned · {stats.pctComplete}% complete ·{" "}
                {stats.teamsStarted}/{stats.teamCount} teams started
              </p>
            </div>

            <div className="mt-4">
              <DisplayCase countByTeamSlug={countByTeamSlug} totalByTeamSlug={totalByTeamSlug} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
