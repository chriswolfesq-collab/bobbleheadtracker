// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthModal } from "@/components/AuthModal";

// Covers the "I forgot my password" detour off the sign-in form. The modal's
// own auth context is stubbed, so what's exercised is the branch logic and the
// one thing that must not regress: the confirmation screen never reveals
// whether the address has an account.

const sendPasswordReset = vi.fn<(email: string) => Promise<{ error: string | null }>>();

vi.mock("@/lib/passwordReset", () => ({
  sendPasswordReset: (email: string) => sendPasswordReset(email),
}));

vi.mock("@/lib/auth", async (importOriginal) => ({
  // validateDisplayName and MAX_DISPLAY_NAME_LENGTH come along unchanged; only
  // the context hook is replaced.
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  useAuth: () => ({
    isAuthModalOpen: true,
    authModalMode: "sign-in" as const,
    openAuthModal: vi.fn(),
    closeAuthModal: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    oauthError: null,
    clearOauthError: vi.fn(),
  }),
}));

beforeEach(() => {
  sendPasswordReset.mockReset();
  sendPasswordReset.mockResolvedValue({ error: null });
});

afterEach(cleanup);

const click = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));

// The confirmation renders a typographic apostrophe and wraps the address in a
// <strong>, so the text is split across nodes. Match the paragraph as a whole.
const CONFIRMATION = /if there.s an account for/i;
const confirmationText = () =>
  screen.queryAllByText(
    (_content, element) =>
      element?.tagName === "P" && CONFIRMATION.test(element.textContent ?? ""),
  );

const openForgotForm = () => {
  render(<AuthModal />);
  click(/forgot password\?/i);
};

const fillEmail = (value: string) => {
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value } });
};

describe("the forgot-password detour", () => {
  it("swaps the sign-in form for the reset form and back again", () => {
    openForgotForm();
    expect(screen.getByRole("heading", { name: /reset your password/i })).toBeTruthy();
    // Anchored: the dialog itself is labelled "Reset your password", and only
    // the sign-in form's field is labelled exactly "Password".
    expect(screen.queryByLabelText(/^password$/i)).toBeNull();

    click(/back to sign in/i);
    expect(screen.getByRole("heading", { name: /^sign in$/i })).toBeTruthy();
  });

  it("sends the link to the address entered, trimmed", async () => {
    openForgotForm();
    fillEmail("  collector@example.com  ");
    click(/send reset link/i);

    await waitFor(() =>
      expect(sendPasswordReset).toHaveBeenCalledWith("collector@example.com"),
    );
  });

  // The whole point of the conditional wording: Supabase reports success for an
  // address with no account, so anything flatly claiming an email was sent would
  // turn this form into a way to find out who is registered.
  it("confirms without confirming that the account exists", async () => {
    openForgotForm();
    fillEmail("stranger@example.com");
    click(/send reset link/i);

    await waitFor(() => expect(confirmationText()).toHaveLength(1));
    expect(confirmationText()[0].textContent).toContain("stranger@example.com");
  });

  it("shows a failure instead of the confirmation screen", async () => {
    sendPasswordReset.mockResolvedValue({ error: "Email rate limit exceeded" });
    openForgotForm();
    fillEmail("collector@example.com");
    click(/send reset link/i);

    expect(await screen.findByText(/rate limit exceeded/i)).toBeTruthy();
    expect(confirmationText()).toHaveLength(0);
  });
});
