// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InboxPageClient } from "@/app/inbox/InboxPageClient";
import type { InboxConversation } from "@/lib/messages";

// The member's inbox. The thread view is stubbed — it has its own reasoning and
// its own RPCs — so what's covered here is the shell: who gets in, when the
// "message the admins" starter is offered, and that opening a conversation opens
// the right one.

const messageAdmin = vi.fn();
const reload = vi.fn();

let user: { id: string } | null = { id: "member-1" };
let conversations: InboxConversation[] = [];

const adminThread = (overrides: Partial<InboxConversation> = {}): InboxConversation => ({
  conversation_id: "conv-1",
  kind: "admin",
  title: "Bobble Shelf",
  other_slug: null,
  other_avatar_path: null,
  last_message_at: "2026-08-18T15:00:00.000Z",
  last_message_preview: "We fixed that listing for you.",
  last_sender_role: "admin",
  unread_count: 2,
  ...overrides,
});

vi.mock("@/components/Breadcrumbs", () => ({ Breadcrumbs: () => null }));
vi.mock("@/components/ConversationThread", () => ({
  ConversationThread: ({ conversationId }: { conversationId: string }) => (
    <p>thread:{conversationId}</p>
  ),
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user, isLoading: false }) }));

vi.mock("@/lib/messages", async (importOriginal) => ({
  // formatMessageTime is a pure helper the page also uses; only the data layer
  // is replaced.
  ...(await importOriginal<typeof import("@/lib/messages")>()),
  useInbox: () => ({ conversations, isLoading: false, error: null, reload }),
  messageAdmin: (...args: unknown[]) => messageAdmin(...args),
}));

beforeEach(() => {
  user = { id: "member-1" };
  conversations = [];
  messageAdmin.mockReset().mockResolvedValue("conv-new");
  reload.mockReset().mockResolvedValue(undefined);
  // The two-pane auto-select asks for this; jsdom has no matchMedia.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

describe("who can read an inbox", () => {
  it("asks a signed-out visitor to sign in, and offers the email route instead", () => {
    user = null;
    render(<InboxPageClient />);

    expect(screen.getByText(/sign in to read your messages/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /contact form/i })).toBeTruthy();
  });
});

describe("with nothing in it yet", () => {
  it("offers to start the admin thread and sends what's typed", async () => {
    // Starting a thread reloads the list before selecting it, so the stub has to
    // grow the thread the way the real refetch would — otherwise the page is
    // asked to open a conversation nothing has told it about.
    reload.mockImplementation(async () => {
      conversations = [adminThread({ conversation_id: "conv-new", unread_count: 0 })];
    });

    render(<InboxPageClient />);

    fireEvent.change(screen.getByPlaceholderText(/what's going on/i), {
      target: { value: "Is the 1997 Astros set complete?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => expect(messageAdmin).toHaveBeenCalledWith("Is the 1997 Astros set complete?"));
    // Reloaded so the new thread appears, then opened.
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(await screen.findByText("thread:conv-new")).toBeTruthy();
  });

  it("says so plainly rather than showing an empty list", () => {
    render(<InboxPageClient />);
    expect(screen.getByText(/no messages yet/i)).toBeTruthy();
  });
});

describe("with a thread in it", () => {
  it("shows the unread count and the last line, and opens on click", async () => {
    conversations = [adminThread()];
    render(<InboxPageClient />);

    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText(/we fixed that listing/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /bobble shelf/i }));
    expect(await screen.findByText("thread:conv-1")).toBeTruthy();
  });

  it("stops offering to start one, because there already is one", () => {
    conversations = [adminThread()];
    render(<InboxPageClient />);

    expect(screen.queryByPlaceholderText(/what's going on/i)).toBeNull();
  });
});
