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
      title="Back to top"
      className={`fixed bottom-5 right-5 z-30 grid h-11 w-11 place-items-center rounded-full border border-border-soft bg-surface text-lg text-navy shadow-xl transition hover:border-accent hover:text-accent ${
        isVisible ? "opacity-90" : "pointer-events-none opacity-0"
      }`}
    >
      <span aria-hidden>↑</span>
    </button>
  );
}
