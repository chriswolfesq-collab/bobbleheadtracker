// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScrollRestoration } from "@/lib/useScrollRestoration";

// The hook waits on layout and on the clock, neither of which jsdom drives on
// its own, so both are held here: `pageHeight` stands in for the growing grid
// and `now` for the restore deadline.
let pageHeight = 800;
let now = 0;
let frames: FrameRequestCallback[] = [];

function flushFrames() {
  const pending = frames;
  frames = [];
  for (const frame of pending) frame(now);
}

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  window.dispatchEvent(new Event("scroll"));
}

function renderHook() {
  return render(
    createElement(function Probe() {
      useScrollRestoration();
      return null;
    }),
  );
}

beforeEach(() => {
  pageHeight = 800;
  now = 0;
  frames = [];
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((frame) => frames.push(frame));
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  vi.spyOn(window, "scrollTo").mockImplementation((...args: unknown[]) => {
    const y = typeof args[0] === "number" ? (args[1] as number) : 0;
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  });
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    get: () => pageHeight,
    configurable: true,
  });
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  window.history.replaceState({ __NA: true }, "");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useScrollRestoration", () => {
  it("waits for the page to grow tall enough before restoring", () => {
    window.history.replaceState({ __NA: true, __bobbleScrollY: 2400 }, "");
    renderHook();

    // One screen of filters, the list still loading: nowhere to scroll to yet.
    flushFrames();
    expect(window.scrollTo).not.toHaveBeenCalled();

    pageHeight = 5200;
    flushFrames();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 2400);
  });

  it("leaves a freshly opened page at the top", () => {
    renderHook();

    pageHeight = 5200;
    flushFrames();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("lands as far down as it can when the list came back shorter", () => {
    window.history.replaceState({ __NA: true, __bobbleScrollY: 2400 }, "");
    renderHook();

    pageHeight = 1800;
    flushFrames();
    expect(window.scrollTo).not.toHaveBeenCalled();

    now = 6000;
    flushFrames();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 1000);
  });

  it("gives up the restore when the reader scrolls themselves", () => {
    window.history.replaceState({ __NA: true, __bobbleScrollY: 2400 }, "");
    renderHook();

    window.dispatchEvent(new Event("wheel"));
    pageHeight = 5200;
    flushFrames();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("saves the current position without disturbing the router's own state", () => {
    renderHook();

    scrollTo(1500);
    vi.advanceTimersByTime(100);
    expect(window.history.state.__bobbleScrollY).toBeUndefined();

    vi.advanceTimersByTime(500);
    expect(window.history.state).toEqual({ __NA: true, __bobbleScrollY: 1500 });
  });

  it("keeps the saved offset while a restore is still pending", () => {
    window.history.replaceState({ __NA: true, __bobbleScrollY: 2400 }, "");
    renderHook();

    // The arrival position, reported while the grid is still filling in.
    scrollTo(0);
    vi.advanceTimersByTime(1000);
    expect(window.history.state.__bobbleScrollY).toBe(2400);

    pageHeight = 5200;
    flushFrames();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 2400);
  });
});
