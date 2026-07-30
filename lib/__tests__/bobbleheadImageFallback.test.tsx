// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BobbleheadImage } from "@/components/BobbleheadImage";

// next/image resolves srcs through the optimizer and does its own load
// bookkeeping, none of which exists in jsdom. Swapped for a plain <img> so the
// test is about the one thing this component adds: what it shows when a photo
// URL no longer resolves.
vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...rest} />
  ),
}));

afterEach(cleanup);

const DEAD = "https://example.test/deleted.jpg";
const PLACEHOLDER = "/bobbleheads/marlins.png";

describe("BobbleheadImage when a photo has gone missing", () => {
  it("swaps in the fallback so the broken-image icon never shows", () => {
    render(<BobbleheadImage src={DEAD} fallbackSrc={PLACEHOLDER} alt="Billy the Marlin" width={1} height={1} />);

    const image = screen.getByAltText("Billy the Marlin");
    expect(image.getAttribute("src")).toBe(DEAD);

    fireEvent.error(image);
    expect(screen.getByAltText("Billy the Marlin").getAttribute("src")).toBe(PLACEHOLDER);
  });

  it("gives up if the fallback fails too, rather than swapping forever", () => {
    const onError = vi.fn();
    render(
      <BobbleheadImage
        src={DEAD}
        fallbackSrc={PLACEHOLDER}
        alt="Billy the Marlin"
        width={1}
        height={1}
        onError={onError}
      />,
    );

    const image = screen.getByAltText("Billy the Marlin");
    fireEvent.error(image);
    // The first failure is handled internally — the caller isn't told, because
    // there's still a photo left to try.
    expect(onError).not.toHaveBeenCalled();

    fireEvent.error(screen.getByAltText("Billy the Marlin"));
    expect(screen.getByAltText("Billy the Marlin").getAttribute("src")).toBe(PLACEHOLDER);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("passes the failure straight through when there's nothing to fall back to", () => {
    const onError = vi.fn();
    render(<BobbleheadImage src={DEAD} alt="Billy the Marlin" width={1} height={1} onError={onError} />);

    fireEvent.error(screen.getByAltText("Billy the Marlin"));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText("Billy the Marlin").getAttribute("src")).toBe(DEAD);
  });

  it("gives a new photo its own chance rather than inheriting the last one's verdict", () => {
    const { rerender } = render(
      <BobbleheadImage src={DEAD} fallbackSrc={PLACEHOLDER} alt="Billy the Marlin" width={1} height={1} />,
    );

    fireEvent.error(screen.getByAltText("Billy the Marlin"));
    expect(screen.getByAltText("Billy the Marlin").getAttribute("src")).toBe(PLACEHOLDER);

    const replacement = "https://example.test/approved.jpg";
    rerender(
      <BobbleheadImage src={replacement} fallbackSrc={PLACEHOLDER} alt="Billy the Marlin" width={1} height={1} />,
    );
    expect(screen.getByAltText("Billy the Marlin").getAttribute("src")).toBe(replacement);
  });
});
