// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FriendShelfPanel } from "@/components/FriendShelfPanel";

// Messaging from a public shelf page. The button rides in the panel that already
// knows who's looking, so the case that matters most is the one where the answer
// is "you" — nothing should offer to message yourself. The real
// MessageMemberButton is rendered (not stubbed) so the wiring is covered too.

let status = "none";

vi.mock("@/components/PublicGallery", () => ({ default: () => null }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "viewer-1" }, openAuthModal: vi.fn() }),
}));
vi.mock("@/lib/messages", () => ({ startDirectConversation: vi.fn() }));
vi.mock("@/lib/friends", () => ({
  useFriendShelf: () => ({
    status,
    items: [],
    isGalleryLoading: false,
    ownerSharesWithFriends: true,
    send: vi.fn(),
    accept: vi.fn(),
    cancel: vi.fn(),
  }),
}));

const panel = () =>
  render(<FriendShelfPanel slug="dana" displayName="Dana" publicKinds={[]} />);

beforeEach(() => {
  status = "none";
});

afterEach(cleanup);

describe("on someone else's shelf", () => {
  it("offers Message next to Add friend, without requiring the friendship", () => {
    panel();
    expect(screen.getByRole("button", { name: "Add friend" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Message" })).toBeTruthy();
  });

  it("still offers Message once you're friends", () => {
    status = "friends";
    panel();
    expect(screen.getByText(/you and dana are friends/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Message" })).toBeTruthy();
  });

  it("offers it to a signed-out visitor too — the button handles signing in", () => {
    status = "signed-out";
    panel();
    expect(screen.getByRole("button", { name: /sign in to add a friend/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Message" })).toBeTruthy();
  });
});

describe("on your own shelf", () => {
  it("renders nothing at all, so there's no messaging yourself", () => {
    status = "self";
    const { container } = panel();
    expect(container.textContent).toBe("");
    expect(screen.queryByRole("button", { name: "Message" })).toBeNull();
  });
});
