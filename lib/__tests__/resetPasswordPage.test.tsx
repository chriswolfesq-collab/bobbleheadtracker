// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordPageClient } from "@/app/reset-password/ResetPasswordPageClient";

// The page is only reachable by following a one-time link out of an email, so
// the session that link produces is stubbed here. What's under test is the part
// with no server in it: which of the three states shows, and what gets sent
// when the form is submitted.

const getSession = vi.fn<() => Promise<{ data: { session: unknown } }>>();
const updateUser = vi.fn<(attrs: { password: string }) => Promise<{ error: unknown }>>();

vi.mock("@/lib/supabase", () => ({
  // Both are called through a wrapper: vi.mock is hoisted above the consts
  // above, so the factory can only reach them lazily, once a test actually runs.
  supabase: {
    auth: {
      getSession: () => getSession(),
      updateUser: (attrs: { password: string }) => updateUser(attrs),
    },
  },
}));

const withRecoverySession = () => getSession.mockResolvedValue({ data: { session: { user: {} } } });
const withoutSession = () => getSession.mockResolvedValue({ data: { session: null } });

beforeEach(() => {
  getSession.mockReset();
  updateUser.mockReset();
  updateUser.mockResolvedValue({ error: null });
});

afterEach(cleanup);

const type = (label: RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const submit = () => fireEvent.click(screen.getByRole("button", { name: /save new password/i }));

describe("the reset page without a usable link", () => {
  it("says the link expired rather than showing a form that can't work", async () => {
    withoutSession();
    render(<ResetPasswordPageClient />);

    expect(await screen.findByText(/this link has expired/i)).toBeTruthy();
    expect(screen.queryByLabelText(/new password/i)).toBeNull();
  });
});

describe("the reset page with a recovery session", () => {
  beforeEach(withRecoverySession);

  it("sets the password the person chose", async () => {
    render(<ResetPasswordPageClient />);
    await screen.findByLabelText(/^new password$/i);

    type(/^new password$/i, "shelf-of-bobbles");
    type(/confirm new password/i, "shelf-of-bobbles");
    submit();

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "shelf-of-bobbles" }));
    expect(await screen.findByText(/password updated/i)).toBeTruthy();
  });

  // A typo in an invisible field would otherwise be stored as the real
  // password and lock them out for good, so this must never reach Supabase.
  it("refuses to send a password the two fields disagree about", async () => {
    render(<ResetPasswordPageClient />);
    await screen.findByLabelText(/^new password$/i);

    type(/^new password$/i, "shelf-of-bobbles");
    type(/confirm new password/i, "shelf-of-bobblez");
    submit();

    expect(await screen.findByText(/don't match/i)).toBeTruthy();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("surfaces a rejection from Supabase instead of claiming success", async () => {
    updateUser.mockResolvedValue({ error: { message: "New password should be different." } });
    render(<ResetPasswordPageClient />);
    await screen.findByLabelText(/^new password$/i);

    type(/^new password$/i, "shelf-of-bobbles");
    type(/confirm new password/i, "shelf-of-bobbles");
    submit();

    expect(await screen.findByText(/should be different/i)).toBeTruthy();
    expect(screen.queryByText(/password updated/i)).toBeNull();
  });
});
