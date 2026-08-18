// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessageMemberButton } from "@/components/MessageMemberButton";

// Messaging another member. The database decides who may be reached and says so
// in one sentence for every reason (see supabase/direct_messages.sql), so what's
// covered here is that this component asks, shows what it's told, and doesn't
// invite a second copy of a message it already sent.

const startDirectConversation = vi.fn();
const openAuthModal = vi.fn();

let user: { id: string } | null = { id: "member-1" };

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user, openAuthModal }) }));
vi.mock("@/lib/messages", () => ({
  startDirectConversation: (...args: unknown[]) => startDirectConversation(...args),
}));

beforeEach(() => {
  user = { id: "member-1" };
  startDirectConversation.mockReset().mockResolvedValue("conv-9");
  openAuthModal.mockReset();
});

afterEach(cleanup);

const open = () => {
  render(<MessageMemberButton slug="dana" displayName="Dana" />);
  fireEvent.click(screen.getByRole("button", { name: "Message" }));
};

describe("before anything is typed", () => {
  it("sends a signed-out visitor to sign in instead of a dead composer", () => {
    user = null;
    render(<MessageMemberButton slug="dana" displayName="Dana" />);
    fireEvent.click(screen.getByRole("button", { name: "Message" }));

    expect(openAuthModal).toHaveBeenCalledWith("sign-in");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("won't send an empty message", () => {
    open();
    const send = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
  });
});

describe("sending", () => {
  it("addresses the member by slug and carries the first line", async () => {
    open();
    fireEvent.change(screen.getByPlaceholderText(/say hello to dana/i), {
      target: { value: "Where did you find the 1997 set?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(startDirectConversation).toHaveBeenCalledWith("dana", "Where did you find the 1997 set?"),
    );
  });

  it("points at the inbox afterwards rather than offering to send again", async () => {
    open();
    fireEvent.change(screen.getByPlaceholderText(/say hello to dana/i), {
      target: { value: "Hello!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("link", { name: /in your inbox/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Message" })).toBeNull();
  });

  it("shows the database's refusal as given, without guessing at a reason", async () => {
    startDirectConversation.mockRejectedValue(
      new Error("You can't start a conversation with that collector."),
    );
    open();
    fireEvent.change(screen.getByPlaceholderText(/say hello to dana/i), {
      target: { value: "Hello!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(/can't start a conversation with that collector/i)).toBeTruthy();
    // Still open, so the typing isn't lost.
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
