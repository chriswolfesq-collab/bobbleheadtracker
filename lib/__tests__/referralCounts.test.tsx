// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferAFriend } from "@/components/ReferAFriend";

// The panel must never state a referral count it doesn't actually have.
//
// Robert, the Giants rep, reported his referral number reading 0 after a friend
// signed up. The database was right — two rows, one qualifying. The panel was
// wrong: `joined` and `qualified` start at 0 and the tiles rendered them
// straight, so "still loading", "the load failed" and "two friends joined"
// were all displayed as the same confident zero. To a collector who has just
// referred someone, 0 doesn't read as "loading", it reads as "didn't count".

let referral: {
  code: string | null;
  joined: number;
  qualified: number;
  isLoading: boolean;
  error: string | null;
};

vi.mock("@/lib/referrals", () => ({
  useMyReferral: () => referral,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "u1" },
    isLoading: false,
    openAuthModal: vi.fn(),
  }),
}));

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ showError: vi.fn() }),
}));

beforeEach(() => {
  referral = { code: null, joined: 0, qualified: 0, isLoading: true, error: null };
});

afterEach(cleanup);

/** The two big numbers, in order: friends joined, then the qualifying subset. */
function counts(): string[] {
  return screen.getAllByText(/^(—|\d+)$/).map((node) => node.textContent ?? "");
}

describe("the referral counts", () => {
  it("shows nothing rather than zero while the load is in flight", () => {
    render(<ReferAFriend />);

    expect(counts()).toEqual(["—", "—"]);
    expect(screen.queryByText("0")).toBeNull();
  });

  it("shows nothing rather than zero when the load failed", () => {
    referral = { code: null, joined: 0, qualified: 0, isLoading: false, error: "Couldn't load." };

    render(<ReferAFriend />);

    expect(counts()).toEqual(["—", "—"]);
  });

  // The error used to render only inside the link box, leaving two bare zeroes
  // sitting underneath with nothing to explain them.
  it("explains itself next to the counts when the load failed", () => {
    referral = { code: null, joined: 0, qualified: 0, isLoading: false, error: "Couldn't load." };

    render(<ReferAFriend />);

    expect(screen.getAllByText("Couldn't load.").length).toBeGreaterThan(1);
  });

  it("shows the real numbers once they arrive", () => {
    referral = { code: "robert-palacioz", joined: 2, qualified: 1, isLoading: false, error: null };

    render(<ReferAFriend />);

    expect(counts()).toEqual(["2", "1"]);
  });

  // A genuine zero is still a zero — someone who has referred nobody should see
  // 0, not a dash that reads as "we don't know".
  it("shows a real zero for someone who has referred nobody", () => {
    referral = { code: "someone-else", joined: 0, qualified: 0, isLoading: false, error: null };

    render(<ReferAFriend />);

    expect(counts()).toEqual(["0", "0"]);
  });

  // A refetch that fails must not blank numbers already on screen — the tab
  // regaining focus is the common trigger, and flickering to "—" every time the
  // network hiccups is worse than showing a slightly stale count.
  it("keeps the numbers it already has when a refetch fails", () => {
    referral = {
      code: "robert-palacioz",
      joined: 2,
      qualified: 1,
      isLoading: false,
      error: "Couldn't load.",
    };

    render(<ReferAFriend />);

    expect(counts()).toEqual(["2", "1"]);
  });
});
