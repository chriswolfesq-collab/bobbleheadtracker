// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthModal } from "@/components/AuthModal";

// Covers the auth modal with CAPTCHA switched ON. The unconfigured case — no
// site key, nothing rendered, nothing gated — is what every other AuthModal
// test already runs under, since captchaEnabled is false without the env var.

vi.mock("@/lib/turnstile", () => ({
  TURNSTILE_SITE_KEY: "test-site-key",
  captchaEnabled: true,
}));

// Stands in for Cloudflare's script, which can't load in jsdom. Mirrors the one
// behaviour the modal depends on: a bumped resetSignal invalidates the token.
vi.mock("@/components/TurnstileWidget", () => ({
  TurnstileWidget: ({
    onToken,
    onUnavailable,
    resetSignal = 0,
  }: {
    onToken: (token: string | null) => void;
    onUnavailable?: () => void;
    resetSignal?: number;
  }) => {
    useEffect(() => {
      if (resetSignal > 0) onToken(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resetSignal]);

    return (
      <div>
        <button type="button" onClick={() => onToken(`token-${resetSignal}`)}>
          pass challenge
        </button>
        <button type="button" onClick={() => onUnavailable?.()}>
          block script
        </button>
        <span data-testid="challenge-round">{resetSignal}</span>
      </div>
    );
  },
}));

const signIn = vi.fn<(email: string, password: string, captchaToken?: string) => Promise<{ error: string | null }>>();

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  useAuth: () => ({
    isAuthModalOpen: true,
    authModalMode: "sign-in" as const,
    openAuthModal: vi.fn(),
    closeAuthModal: vi.fn(),
    signIn,
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    oauthError: null,
    clearOauthError: vi.fn(),
  }),
}));

beforeEach(() => {
  signIn.mockReset();
  signIn.mockResolvedValue({ error: null });
});

afterEach(cleanup);

// "Continue with Google" also matches /continue/i, so match the exact label.
const submitButton = () => screen.getByRole("button", { name: "Continue" });
const passChallenge = () => fireEvent.click(screen.getByRole("button", { name: /pass challenge/i }));

const fillCredentials = () => {
  fireEvent.change(screen.getByPlaceholderText(/enter your email address/i), {
    target: { value: "collector@example.com" },
  });
  fireEvent.change(screen.getByPlaceholderText(/enter your password/i), {
    target: { value: "shelf-of-bobbles" },
  });
};

describe("AuthModal with CAPTCHA enabled", () => {
  it("keeps the submit button disabled until the challenge passes", () => {
    render(<AuthModal />);

    expect(submitButton().hasAttribute("disabled")).toBe(true);
    passChallenge();
    expect(submitButton().hasAttribute("disabled")).toBe(false);
  });

  it("sends the token along with the credentials", async () => {
    render(<AuthModal />);
    passChallenge();
    fillCredentials();

    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("collector@example.com", "shelf-of-bobbles", "token-0"),
    );
  });

  // Turnstile tokens are single-use: without a fresh challenge the retry would
  // present a spent token and fail for a second, more confusing reason.
  it("re-runs the challenge after a rejected attempt", async () => {
    signIn.mockResolvedValue({ error: "That email or password isn't right." });
    render(<AuthModal />);
    passChallenge();
    fillCredentials();

    fireEvent.click(submitButton());

    await screen.findByText(/isn't right/i);
    expect(screen.getByTestId("challenge-round").textContent).toBe("1");
    expect(submitButton().hasAttribute("disabled")).toBe(true);

    // And the retry carries the new token, not the spent one.
    passChallenge();
    fireEvent.click(submitButton());
    await waitFor(() =>
      expect(signIn).toHaveBeenLastCalledWith(
        "collector@example.com",
        "shelf-of-bobbles",
        "token-1",
      ),
    );
  });

  // The widget draws no UI of its own until Cloudflare's script arrives, so a
  // blocked script would otherwise leave a dead button and a blank space.
  it("explains itself when the challenge script can't load", async () => {
    render(<AuthModal />);

    fireEvent.click(screen.getByRole("button", { name: /block script/i }));

    expect(await screen.findByText(/couldn.t load the bot check/i)).toBeTruthy();
    expect(submitButton().hasAttribute("disabled")).toBe(true);
  });

  it("gates the forgot-password form too", () => {
    render(<AuthModal />);
    fireEvent.click(screen.getByRole("button", { name: /forgot password\?/i }));

    const sendButton = screen.getByRole("button", { name: /send reset link/i });
    expect(sendButton.hasAttribute("disabled")).toBe(true);

    passChallenge();
    expect(
      screen.getByRole("button", { name: /send reset link/i }).hasAttribute("disabled"),
    ).toBe(false);
  });
});
