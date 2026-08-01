// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhotoGallery } from "@/components/PhotoGallery";

// Removing a gallery photo used to be gated on window.confirm, which a browser
// is free to suppress — and on the Padres rep's phone it did, so Remove was
// silently dead while working for everyone else. The confirmation now lives in
// the component, where nothing outside the app can swallow it. These tests pin
// the part that matters: one tap never deletes, and the delete happens only
// after an explicit second tap.

const PHOTOS = [
  { id: "photo-1", imageUrl: "https://example.com/one.jpg", createdAt: "2026-01-01T00:00:00Z" },
];

// next/image wants a configured loader; the gallery only needs an <img> here.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

afterEach(cleanup);

function renderGallery(onDelete: (photo: (typeof PHOTOS)[number]) => void) {
  return render(<PhotoGallery photos={PHOTOS} isManaging onDelete={onDelete} />);
}

describe("gallery photo removal", () => {
  it("does not delete on the first tap of Remove", () => {
    const onDelete = vi.fn();
    renderGallery(onDelete);

    fireEvent.click(screen.getByText("Remove"));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Remove for everyone?")).toBeDefined();
  });

  it("deletes once the removal is confirmed", () => {
    const onDelete = vi.fn();
    renderGallery(onDelete);

    fireEvent.click(screen.getByText("Remove"));
    fireEvent.click(screen.getByText("Yes"));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(PHOTOS[0]);
  });

  it("backs out to the normal controls on No, without deleting", () => {
    const onDelete = vi.fn();
    renderGallery(onDelete);

    fireEvent.click(screen.getByText("Remove"));
    fireEvent.click(screen.getByText("No"));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Remove")).toBeDefined();
  });

  it("shows no controls at all without edit rights", () => {
    render(<PhotoGallery photos={PHOTOS} isManaging />);

    expect(screen.queryByText("Remove")).toBeNull();
  });
});
