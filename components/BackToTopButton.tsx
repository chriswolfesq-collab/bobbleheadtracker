"use client";

import { useEffect, useState } from "react";

export function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > 400);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-black/10 bg-white/70 px-5 py-2.5 text-xs font-medium tracking-wide text-zinc-700 shadow-xl backdrop-blur transition hover:bg-white/85 hover:text-accent-hover dark:border-white/15 dark:bg-[#101827]/60 dark:text-zinc-300 dark:hover:bg-[#101827]/85 dark:hover:text-accent-hover ${
        isVisible ? "opacity-90" : "pointer-events-none opacity-0"
      }`}
    >
      <span aria-hidden>↑</span>
      Back to top
    </button>
  );
}
