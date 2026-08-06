// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditBobbleheadDialog, type EditBobbleheadValues } from "@/components/EditBobbleheadDialog";

// The rarity control is behind an admin sign-in, so the dialog is exercised on
// its own and what's under test is what it sends: rarity is a choice someone
// makes here, and nothing on this form derives one from the quantity.

const onSave = vi.fn<(values: EditBobbleheadValues, file: File | null) => Promise<void>>();

const BASE: EditBobbleheadValues = {
  title: "Travis Scott",
  nickname: "",
  quantity: "2,000",
  date: "February 23, 2025",
  city: null,
  rarity: null,
  rarityNote: "",
};

beforeEach(() => {
  onSave.mockReset();
  onSave.mockResolvedValue(undefined);
});

afterEach(cleanup);

const renderDialog = (initial: Partial<EditBobbleheadValues> = {}) =>
  render(
    <EditBobbleheadDialog
      onClose={() => {}}
      initial={{ ...BASE, ...initial }}
      onSave={onSave}
      onDelete={async () => {}}
    />,
  );

const save = () => fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
const rarityField = () => screen.getByRole("combobox") as HTMLSelectElement;

describe("the rarity field", () => {
  it("starts on no badge, however small the print run", () => {
    renderDialog();
    expect(rarityField().value).toBe("");
  });

  it("sends the tier that was picked", async () => {
    renderDialog();
    fireEvent.change(rarityField(), { target: { value: "ultra-rare" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].rarity).toBe("ultra-rare");
  });

  // The case the old quantity rule could never express: nothing is on record
  // about how many were made, and it's still the rarest thing on the shelf.
  it("marks a bobblehead whose quantity is unknown", async () => {
    renderDialog({ quantity: "Unknown" });
    fireEvent.change(rarityField(), { target: { value: "ultra-rare" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].rarity).toBe("ultra-rare");
    expect(onSave.mock.calls[0][0].quantity).toBe("Unknown");
  });

  it("clears a badge that was set", async () => {
    renderDialog({ rarity: "rare", rarityNote: "Hard to find" });
    expect(rarityField().value).toBe("rare");

    fireEvent.change(rarityField(), { target: { value: "" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].rarity).toBeNull();
  });

  it("offers the note only once there's a badge to explain", () => {
    renderDialog();
    expect(screen.queryByPlaceholderText(/known to exist/i)).toBeNull();

    fireEvent.change(rarityField(), { target: { value: "limited" } });
    expect(screen.getByPlaceholderText(/known to exist/i)).toBeTruthy();
  });

  it("sends the stated reason with the tier", async () => {
    renderDialog();
    fireEvent.change(rarityField(), { target: { value: "rare" } });
    fireEvent.change(screen.getByPlaceholderText(/known to exist/i), {
      target: { value: "  Never turns up on eBay  " },
    });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].rarityNote).toBe("Never turns up on eBay");
  });

  // A note left behind by a badge that was then cleared would otherwise sit on
  // the row explaining a badge that isn't there any more.
  it("drops the note when the badge is cleared", async () => {
    renderDialog({ rarity: "rare", rarityNote: "Hard to find" });
    fireEvent.change(rarityField(), { target: { value: "" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].rarityNote).toBe("");
  });
});
