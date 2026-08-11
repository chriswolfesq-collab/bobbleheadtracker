import { beforeEach, describe, expect, it, vi } from "vitest";

// What's under test is the stash lifecycle, which is the part that can silently
// misattribute someone. A code parked in localStorage outlives the page that
// set it — through an email confirmation link and an OAuth redirect, which is
// the whole point — so the rules about when it is cleared are what stop it
// attaching itself to the wrong account later.

const rpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (fn: string, args: unknown) => rpc(fn, args),
  },
}));

// The suite runs in node, so there's no window. A Map-backed stand-in is enough
// for these functions and keeps the assertions about what's stored honest.
const store = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
});

const {
  claimStashedReferral,
  clearStashedReferralCode,
  readStashedReferralCode,
  referralUrl,
  REFERRAL_PARAM,
} = await import("@/lib/referrals");

beforeEach(() => {
  store.clear();
  rpc.mockReset();
});

describe("referralUrl", () => {
  it("hangs the code off the origin as a query parameter", () => {
    expect(referralUrl("chris-w", "https://bobbleshelf.com")).toBe(
      `https://bobbleshelf.com/?${REFERRAL_PARAM}=chris-w`,
    );
  });

  // slugify() caps codes at ASCII, but it has a 'collector' fallback for names
  // it can't fold, and nothing stops a future code scheme from using other
  // characters. Encoding here means the link survives whatever it's given.
  it("encodes a code that isn't URL-safe", () => {
    expect(referralUrl("a b&c", "https://bobbleshelf.com")).toContain("a%20b%26c");
  });
});

describe("the stash", () => {
  it("reads back nothing when no invite has been seen", () => {
    expect(readStashedReferralCode()).toBeNull();
  });

  it("does nothing when there is no code to claim", async () => {
    await claimStashedReferral();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("claimStashedReferral", () => {
  beforeEach(() => {
    store.set("bobbleshelf.referral", "chris-w");
  });

  it("hands the stashed code to claim_referral", async () => {
    rpc.mockResolvedValue({ data: "claimed", error: null });

    await claimStashedReferral();

    expect(rpc).toHaveBeenCalledWith("claim_referral", { p_code: "chris-w" });
    expect(readStashedReferralCode()).toBeNull();
  });

  // The rejections are permanent — a second attempt would get the same answer.
  // Leaving the code in place would mean it eventually lands on whoever next
  // signs in on a shared computer.
  it.each(["self", "already_referred", "too_late", "unknown_code"])(
    "clears the code after a %s rejection",
    async (result) => {
      rpc.mockResolvedValue({ data: result, error: null });

      await claimStashedReferral();

      expect(readStashedReferralCode()).toBeNull();
    },
  );

  // The one case that might succeed later: the referral is worth a raffle
  // entry, so a dropped connection must not cost someone their credit.
  it("keeps the code when the call itself fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "network down" } });

    await claimStashedReferral();

    expect(readStashedReferralCode()).toBe("chris-w");
  });

  it("only tries once per call, even after clearing", async () => {
    rpc.mockResolvedValue({ data: "claimed", error: null });

    await claimStashedReferral();
    await claimStashedReferral();

    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("clearStashedReferralCode", () => {
  it("removes a parked code", () => {
    store.set("bobbleshelf.referral", "chris-w");

    clearStashedReferralCode();

    expect(readStashedReferralCode()).toBeNull();
  });
});
