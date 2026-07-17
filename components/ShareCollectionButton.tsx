"use client";

import { toCanvas } from "html-to-image";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import DisplayCase from "@/components/DisplayCase";
import { useToast } from "@/components/Toast";
import { copyText } from "@/lib/clipboard";
import type { ShelfSharing } from "@/lib/profile";
import type { ShelfStats } from "@/lib/shelfStats";

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

// None of these accept an image: they take a URL and read the picture from the
// shared page's Open Graph tags, which is what app/shelf/[slug]/opengraph-image
// generates. Facebook takes no text at all — its card is entirely OG-driven.
function socialTargets(url: string, text: string) {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);

  return [
    { name: "X", href: `https://x.com/intent/post?text=${encodedText}&url=${encodedUrl}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: "Reddit", href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}` },
  ];
}

export function ShareCollectionButton({
  displayName,
  countByTeamSlug,
  totalByTeamSlug,
  stats,
  sharing,
  isLoading = false,
  variant = "default",
}: {
  displayName: string;
  countByTeamSlug: Record<string, number>;
  totalByTeamSlug: Record<string, number>;
  stats: ShelfStats;
  /** Lifted to the profile page so the toggle and both share buttons share one fetch. */
  sharing: ShelfSharing;
  /** Counts still loading. The button would otherwise share an empty 0/0 shelf. */
  isLoading?: boolean;
  /** "overlay" sits on top of the shelf art, so it carries more contrast than the
   *  default, which sits on the page background. */
  variant?: "default" | "overlay";
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [didCopy, setDidCopy] = useState(false);
  const { showError } = useToast();

  const { shelf, isSaving, setPublic } = sharing;

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!didCopy) return;

    const timer = setTimeout(() => setDidCopy(false), 2000);
    return () => clearTimeout(timer);
  }, [didCopy]);

  const shelfUrl =
    shelf.isPublic && shelf.slug && typeof window !== "undefined"
      ? `${window.location.origin}/shelf/${shelf.slug}`
      : null;

  // Stated flatly rather than as a boast or a dare. The number is the provocation.
  const shareText = `I've got ${stats.totalOwned} MLB bobbleheads on my shelf.`;

  async function buildImage(): Promise<Blob | null> {
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
      return await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
    } catch (error) {
      console.error("Failed to render share image", error);
      return null;
    } finally {
      setIsMounted(false);
    }
  }

  async function handleSaveImage() {
    if (isBusy) return;

    setIsBusy(true);
    const blob = await buildImage();
    setIsBusy(false);

    if (!blob) {
      showError("Couldn't build the image. Try again.");
      return;
    }
    downloadBlob(blob, "bobblehead-shelf.jpg");
  }

  async function handleNativeShare() {
    if (!shelfUrl) return;

    try {
      // The URL, not the image: every target that matters unfurls it into a
      // card via the shelf page's OG tags, and a link is the thing that brings
      // someone back to the site. An attached image is a dead end.
      await navigator.share({ title: `${displayName}'s bobblehead shelf`, text: shareText, url: shelfUrl });
      setIsOpen(false);
    } catch (error) {
      // Backing out of the share sheet is not a failure.
      if ((error as Error)?.name === "AbortError") return;
      console.error("Share sheet failed", error);
    }
  }

  async function handleCopy() {
    if (!shelfUrl) return;

    if (await copyText(`${shareText} ${shelfUrl}`)) {
      setDidCopy(true);
      return;
    }
    showError("Couldn't copy. Select the link below and copy it manually.");
  }

  async function handleMakePublic() {
    const { error } = await setPublic(true);
    if (error) showError(error);
  }

  const canNativeShare = typeof navigator !== "undefined" && Boolean(navigator.share);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={isLoading}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition hover:border-amber-400 hover:text-amber-300 disabled:opacity-60 ${
          variant === "overlay"
            ? "border-amber-400/40 bg-[#101827]/90 text-amber-100 shadow-lg backdrop-blur-sm"
            : "border-white/15 bg-white/5 text-zinc-300"
        }`}
      >
        <span aria-hidden>↗</span>
        {/* The count rides on the button itself: it's the thing worth showing off,
            and it makes the button an invitation rather than a utility. */}
        {isLoading ? "Share" : `Share my ${stats.totalOwned}`}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-8"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Share your shelf"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#101827] p-5 text-left shadow-2xl"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-400">
              Share your shelf
            </p>
            <p className="mt-2 text-2xl font-black text-white">
              {stats.totalOwned} bobbleheads
            </p>
            <p className="mt-1 text-xs font-bold text-zinc-500">
              {stats.totalOwned} of {stats.siteTotal} · {stats.teamsStarted} of {stats.teamCount}{" "}
              teams started
            </p>

            {shelfUrl ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {canNativeShare ? (
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="flex-1 rounded-lg bg-amber-400 px-3 py-2.5 text-[11px] font-black uppercase tracking-wide text-[#0e1626] transition hover:bg-amber-300"
                    >
                      Share…
                    </button>
                  ) : null}
                  {socialTargets(shelfUrl, shareText).map((target) => (
                    <a
                      key={target.name}
                      href={target.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsOpen(false)}
                      className="flex-1 rounded-lg border border-white/15 px-3 py-2.5 text-center text-[11px] font-black uppercase tracking-wide text-zinc-300 transition hover:border-amber-400 hover:text-amber-300"
                    >
                      {target.name}
                    </a>
                  ))}
                </div>

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex-1 rounded-lg border border-white/15 px-3 py-2.5 text-[11px] font-black uppercase tracking-wide text-zinc-300 transition hover:border-amber-400 hover:text-amber-300"
                  >
                    {didCopy ? "Copied" : "Copy link"}
                  </button>
                  {/* Kept for the places a link doesn't unfurl — Instagram, a
                      group chat that strips previews — where the picture is the
                      only thing that travels. */}
                  <button
                    type="button"
                    onClick={handleSaveImage}
                    disabled={isBusy}
                    className="flex-1 rounded-lg border border-white/15 px-3 py-2.5 text-[11px] font-black uppercase tracking-wide text-zinc-300 transition hover:border-amber-400 hover:text-amber-300 disabled:opacity-60"
                  >
                    {isBusy ? "Building…" : "Save image"}
                  </button>
                </div>

                {/* select-all so one click grabs the whole URL — this is the
                    manual escape hatch when copyText fails. */}
                <p className="mt-3 select-all truncate text-[11px] text-zinc-500">{shelfUrl}</p>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm text-zinc-400">
                  Your shelf is private. Turn it on to get a link that shows your collection and
                  your count.
                </p>
                <button
                  type="button"
                  onClick={handleMakePublic}
                  disabled={isSaving}
                  className="mt-4 w-full rounded-lg bg-amber-400 px-3 py-2.5 text-[11px] font-black uppercase tracking-wide text-[#0e1626] transition hover:bg-amber-300 disabled:opacity-60"
                >
                  {isSaving ? "Turning on…" : "Make my shelf public"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveImage}
                  disabled={isBusy}
                  className="mt-2 w-full rounded-lg border border-white/15 px-3 py-2.5 text-[11px] font-black uppercase tracking-wide text-zinc-300 transition hover:border-amber-400 hover:text-amber-300 disabled:opacity-60"
                >
                  {isBusy ? "Building…" : "Just save the image"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

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
            // text-left is load-bearing: the overlay variant is wrapped in a
            // text-right container in ProfileSections, and this card renders
            // inside that wrapper, so the alignment cascades in and shunts the
            // header to the right edge of the captured image.
            className="pb-4 pt-6 text-left"
          >
            <div className="px-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-500/80">
                MLB Bobblehead Shelf
              </p>
              <div className="mt-1 flex items-baseline gap-3">
                <p className="text-3xl font-black text-white">{displayName}</p>
                <p className="text-3xl font-black text-amber-400">{stats.totalOwned}</p>
              </div>
              <p className="mt-2 text-xs font-bold text-zinc-400">
                {stats.totalOwned}/{stats.siteTotal} owned · {stats.teamsStarted}/{stats.teamCount}{" "}
                teams started
              </p>
            </div>

            <div className="mt-4">
              <DisplayCase countByTeamSlug={countByTeamSlug} totalByTeamSlug={totalByTeamSlug} />
            </div>

            {/* The image travels without its link on Instagram and the like, so
                the address rides along inside the picture. */}
            <p className="px-8 pt-2 text-center text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
              {shelf.isPublic && shelf.slug ? `bobbleshelf.com/shelf/${shelf.slug}` : "bobbleshelf.com"}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
