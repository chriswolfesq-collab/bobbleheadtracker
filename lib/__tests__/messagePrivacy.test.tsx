// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagePrivacyToggle } from "@/components/MessagePrivacyToggle";
import type { MessageBlock } from "@/lib/messages";

// The two controls that decide who can reach you: the switch for everyone, and
// the block list for one person. What matters here is the copy telling the truth
// about what each does — particularly that switching members off never closes
// the thread with the admins, which is the promise supabase/messages.sql keeps by
// not gating message_admin on it.

const setEnabled = vi.fn();
const unblock = vi.fn();
const showError = vi.fn();

let enabled = true;
let blocks: MessageBlock[] = [];

vi.mock("@/components/Toast", () => ({ useToast: () => ({ showError }) }));
vi.mock("@/lib/messages", () => ({
  useMessageBlocks: () => ({ blocks, isLoading: false, error: null, unblock }),
}));

const privacy = () => ({ enabled, isLoading: false, isSaving: false, setEnabled });

beforeEach(() => {
  enabled = true;
  blocks = [];
  setEnabled.mockReset().mockResolvedValue({ error: null });
  unblock.mockReset().mockResolvedValue(undefined);
  showError.mockReset();
});

afterEach(cleanup);

describe("the switch", () => {
  it("says the admin thread stays open either way", () => {
    render(<MessagePrivacyToggle privacy={privacy()} />);
    expect(screen.getByText(/you can always reach us/i)).toBeTruthy();
  });

  it("explains that existing threads survive being switched off", () => {
    enabled = false;
    render(<MessagePrivacyToggle privacy={privacy()} />);
    expect(screen.getByText(/threads you're already in still work/i)).toBeTruthy();
  });

  it("flips through the RPC and reports a refusal as a toast", async () => {
    setEnabled.mockResolvedValue({ error: "Couldn't update that. Try again." });
    render(<MessagePrivacyToggle privacy={privacy()} />);

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(false));
    await waitFor(() => expect(showError).toHaveBeenCalledWith("Couldn't update that. Try again."));
  });
});

describe("the block list", () => {
  it("stays out of the way when nobody is blocked", () => {
    render(<MessagePrivacyToggle privacy={privacy()} />);
    expect(screen.queryByText("Blocked")).toBeNull();
  });

  it("lists who's blocked and undoes it by slug", async () => {
    blocks = [
      { slug: "dana", display_name: "Dana", avatar_path: null, created_at: "2026-08-18T12:00:00Z" },
    ];
    render(<MessagePrivacyToggle privacy={privacy()} />);

    expect(screen.getByText("Blocked")).toBeTruthy();
    expect(screen.getByText("Dana")).toBeTruthy();
    // The copy has to be honest about what a block did and didn't do.
    expect(screen.getByText(/they're never told/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /unblock/i }));
    await waitFor(() => expect(unblock).toHaveBeenCalledWith("dana"));
  });
});
