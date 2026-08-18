// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberSearch } from "@/components/MemberSearch";
import type { MemberResult, useMemberSearch } from "@/lib/friends";

// A search result must never offer an action that can't happen. The row for
// someone you already asked, someone who already asked you, and someone you're
// already friends with all have to say so — an "Add friend" button on any of
// them sends a request the database will refuse, and the member learns that
// only from an error.

vi.mock("@/lib/avatar", () => ({ avatarPublicUrl: () => null }));

// Each result row now carries a Message button, which reads the auth context for
// whether to open a composer or the sign-in modal. Stubbed rather than wrapped in
// AuthProvider: this file is about the search rows, and a real provider would drag
// a Supabase session in with it.
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "searcher-1" }, openAuthModal: vi.fn() }),
}));

afterEach(cleanup);

function member(overrides: Partial<MemberResult> = {}): MemberResult {
  return {
    userId: "u1",
    displayName: "Alex Ramirez",
    avatarPath: null,
    slug: "alex-ramirez",
    status: "none",
    ...overrides,
  };
}

function harness(overrides: Partial<ReturnType<typeof useMemberSearch>> = {}) {
  return {
    draft: "alex",
    setDraft: vi.fn(),
    query: "alex",
    results: [] as MemberResult[],
    isSearching: false,
    hasSearched: true,
    error: null,
    ask: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as ReturnType<typeof useMemberSearch>;
}

describe("MemberSearch", () => {
  it("offers Add friend only to a stranger", () => {
    render(<MemberSearch search={harness({ results: [member()] })} />);
    expect(screen.getByRole("button", { name: "Add friend" })).toBeTruthy();
  });

  it.each([
    ["friends", "Already friends"],
    ["pending_out", "Request sent"],
    ["pending_in", "They asked you — see below"],
  ] as const)("states the standing instead of a button for %s", (status, label) => {
    render(<MemberSearch search={harness({ results: [member({ status })] })} />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add friend" })).toBeNull();
  });

  it("shows the failure on the row when the request is refused", async () => {
    const ask = vi.fn().mockResolvedValue("That's a lot of friend requests in one hour.");
    render(<MemberSearch search={harness({ results: [member()], ask })} />);

    fireEvent.click(screen.getByRole("button", { name: "Add friend" }));

    await waitFor(() =>
      expect(screen.getByText("That's a lot of friend requests in one hour.")).toBeTruthy(),
    );
    // Still pressable: the hourly cap clears, so the row must not be left dead.
    expect(screen.getByRole("button", { name: "Add friend" })).toBeTruthy();
  });

  // The empty list and the too-short query are different facts. Reporting the
  // second as the first tells a member nobody matches when nothing was searched.
  it("distinguishes a too-short query from a genuine miss", () => {
    const { unmount } = render(
      <MemberSearch search={harness({ draft: "a", query: "", hasSearched: false })} />,
    );
    expect(screen.getByText(/Keep typing/)).toBeTruthy();
    expect(screen.queryByText(/No collectors match/)).toBeNull();
    unmount();

    render(<MemberSearch search={harness({ results: [] })} />);
    expect(screen.getByText(/No collectors match/)).toBeTruthy();
  });
});
