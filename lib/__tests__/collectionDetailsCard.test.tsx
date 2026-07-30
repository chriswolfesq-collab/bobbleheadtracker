// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionDetails } from "@/components/CollectionDetails";
import { type CollectionDetail, EMPTY_DETAIL } from "@/lib/collectionDetails";

// The card is only reachable behind a sign-in and an owned bobblehead, so the
// hook that talks to Supabase is stubbed and the component is exercised on its
// own. What's under test is the part that has no server in it: what shows at
// rest, what the form sends, and what it refuses to send.

const save = vi.fn<(next: CollectionDetail) => Promise<boolean>>();
let stubbed: { detail: CollectionDetail; isLoading: boolean };

vi.mock("@/lib/useCollectionDetail", () => ({
  useCollectionDetail: () => ({ ...stubbed, save, isLoggedIn: true }),
}));

beforeEach(() => {
  stubbed = { detail: EMPTY_DETAIL, isLoading: false };
  save.mockReset();
  save.mockResolvedValue(true);
});

afterEach(cleanup);

const renderCard = () =>
  render(<CollectionDetails teamSlug="athletics" bobbleheadId="vida-blue-2024" />);

describe("CollectionDetails at rest", () => {
  it("invites you to fill it in when nothing is recorded", () => {
    renderCard();
    expect(screen.getByText(/add the condition/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /add details/i })).toBeTruthy();
  });

  it("shows what has been recorded, and nothing that hasn't", () => {
    stubbed.detail = {
      condition: "in_box",
      acquiredOn: "2024-03-04",
      pricePaid: null,
      notes: "Bought at the game.",
    };
    renderCard();

    expect(screen.getByText("In box")).toBeTruthy();
    expect(screen.getByText("March 4, 2024")).toBeTruthy();
    expect(screen.getByText("Bought at the game.")).toBeTruthy();
    // No price was recorded, so there's no Paid row to read as "$0.00".
    expect(screen.queryByText("Paid")).toBeNull();
    expect(screen.getByRole("button", { name: /edit details/i })).toBeTruthy();
  });

  // A free giveaway is a price, and has to survive the round trip as one.
  it("shows a recorded zero rather than hiding it", () => {
    stubbed.detail = { ...EMPTY_DETAIL, pricePaid: 0 };
    renderCard();
    expect(screen.getByText("$0.00")).toBeTruthy();
  });
});

describe("CollectionDetails form", () => {
  it("saves what was typed and returns to the read view", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /add details/i }));

    fireEvent.click(screen.getByLabelText("Out of box"));
    fireEvent.change(screen.getByLabelText(/acquired/i), { target: { value: "2019-07-04" } });
    fireEvent.change(screen.getByLabelText(/price paid/i), { target: { value: "$12.50" } });
    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: " chipped bat " } });
    fireEvent.click(screen.getByRole("button", { name: /save details/i }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({
      condition: "out_of_box",
      acquiredOn: "2019-07-04",
      pricePaid: 12.5,
      notes: "chipped bat",
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /save details/i })).toBeNull(),
    );
  });

  it("sends nulls rather than empty strings for fields left blank", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /add details/i }));
    fireEvent.click(screen.getByRole("button", { name: /save details/i }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(EMPTY_DETAIL));
  });

  it("refuses a price that isn't one, without saving", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /add details/i }));

    fireEvent.change(screen.getByLabelText(/price paid/i), { target: { value: "free" } });
    fireEvent.click(screen.getByRole("button", { name: /save details/i }));

    expect(screen.getByText(/isn't a number/i)).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });

  // A failed save has to leave the form up with the typing still in it —
  // closing it would throw away what the person just wrote.
  it("stays open when the save fails", async () => {
    save.mockResolvedValue(false);
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /add details/i }));
    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: "keep me" } });
    fireEvent.click(screen.getByRole("button", { name: /save details/i }));

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /save details/i })).toBeTruthy();
    expect((screen.getByLabelText(/notes/i) as HTMLTextAreaElement).value).toBe("keep me");
  });

  it("drops the edits on cancel", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /add details/i }));
    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: "never mind" } });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /add details/i })).toBeTruthy();
  });
});
