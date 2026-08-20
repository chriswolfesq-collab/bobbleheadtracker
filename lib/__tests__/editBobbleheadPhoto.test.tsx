// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditBobbleheadDialog, type EditBobbleheadValues } from "@/components/EditBobbleheadDialog";

// Removing the photo used to close the dialog, so clearing a curated listing's
// two stacked photos — the approved one, then the stock seed underneath — meant
// reopening it between each removal, and again to upload the replacement. Two
// reps reported that round trip. The dialog now stays put.

const BASE: EditBobbleheadValues = {
  title: "A.J. Pierzynski",
  nickname: "",
  quantity: "20,000",
  date: "May 1, 2026",
  city: null,
  rarity: null,
  rarityNote: "",
};

afterEach(cleanup);

describe("removing the photo from the edit dialog", () => {
  it("keeps the dialog open so the next photo can go straight in", async () => {
    const onClose = vi.fn();
    const onRemovePhoto = vi.fn().mockResolvedValue(undefined);

    render(
      <EditBobbleheadDialog
        onClose={onClose}
        initial={BASE}
        onSave={async () => {}}
        onDelete={async () => {}}
        onRemovePhoto={onRemovePhoto}
        currentPhotoUrl="https://example.com/wrong.jpg"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /remove current photo/i }));

    await waitFor(() => expect(onRemovePhoto).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("shows the photo being replaced, and says a removal isn't needed first", () => {
    render(
      <EditBobbleheadDialog
        onClose={() => {}}
        initial={BASE}
        onSave={async () => {}}
        onDelete={async () => {}}
        onRemovePhoto={async () => {}}
        currentPhotoUrl="https://example.com/wrong.jpg"
      />,
    );

    expect(screen.getByText(/don't need to remove it first/i)).toBeDefined();
    const thumbnail = document.querySelector('img[src="https://example.com/wrong.jpg"]');
    expect(thumbnail).not.toBeNull();
  });

  it("offers no photo controls on a listing that has none", () => {
    render(
      <EditBobbleheadDialog
        onClose={() => {}}
        initial={BASE}
        onSave={async () => {}}
        onDelete={async () => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: /remove current photo/i })).toBeNull();
    expect(screen.queryByText(/don't need to remove it first/i)).toBeNull();
  });
});
