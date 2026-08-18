// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InboundMessageForm } from "@/components/InboundMessageForm";

// Which way a message goes out. The rule has three parts and each is load-bearing:
// a signed-in sender on /contact gets a thread, anyone signed out keeps the email
// path that works without an account, and a rep application stays on email either
// way because /admin/reps assigns a rep by address.

const messageAdmin = vi.fn();
const sendInboundMessage = vi.fn();

let user: { id: string } | null = { id: "member-1" };

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user, isLoading: false }) }));
vi.mock("@/lib/messages", () => ({ messageAdmin: (...args: unknown[]) => messageAdmin(...args) }));
vi.mock("@/lib/inboundMessages", () => ({
  sendInboundMessage: (...args: unknown[]) => sendInboundMessage(...args),
}));

beforeEach(() => {
  user = { id: "member-1" };
  messageAdmin.mockReset().mockResolvedValue("conversation-1");
  sendInboundMessage.mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

const contactForm = (signedInThread: boolean) =>
  render(
    <InboundMessageForm
      kind="contact"
      messageLabel="How can we help?"
      messagePlaceholder="Tell us…"
      submitLabel="Send message"
      {...(signedInThread ? { allowSignedInThread: true } : {})}
    />,
  );

const type = (placeholder: RegExp, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

// The email path's own fields are `required`, and jsdom enforces that before it
// will fire submit — so a test that skips them proves nothing about routing.
const fillEmail = (value: string) => {
  const input = document.querySelector('input[type="email"]');
  if (!input) throw new Error("no email field rendered");
  fireEvent.change(input, { target: { value } });
};

describe("a signed-in member on /contact", () => {
  it("opens a thread instead of sending email, and never asks for an address", () => {
    contactForm(true);

    expect(screen.queryByText("Your email")).toBeNull();
    expect(screen.queryByText("Your name")).toBeNull();

    type(/tell us/i, "Can you fix a listing?");
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    return waitFor(() => {
      expect(messageAdmin).toHaveBeenCalledWith("Can you fix a listing?");
      expect(sendInboundMessage).not.toHaveBeenCalled();
    });
  });

  it("points them at the inbox rather than promising an email", async () => {
    contactForm(true);
    type(/tell us/i, "Can you fix a listing?");
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText(/land in your inbox/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /go to your inbox/i })).toBeTruthy();
  });
});

describe("a visitor with no account", () => {
  it("keeps the email path, addresses and all", async () => {
    user = null;
    contactForm(true);

    expect(screen.getByText("Your email")).toBeTruthy();

    fillEmail("stranger@example.com");
    type(/tell us/i, "No account here.");
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => expect(sendInboundMessage).toHaveBeenCalledTimes(1));
    expect(messageAdmin).not.toHaveBeenCalled();
    expect(sendInboundMessage.mock.calls[0][0]).toMatchObject({
      kind: "contact",
      message: "No account here.",
    });
  });
});

describe("a rep application", () => {
  it("stays on email even for a signed-in applicant", async () => {
    render(
      <InboundMessageForm
        kind="rep_application"
        messageLabel="Why you?"
        messagePlaceholder="Tell us about your collection…"
        submitLabel="Apply"
        allowSignedInThread
      />,
    );

    // The application needs the address the rep will be assigned by.
    expect(screen.getByText("Your email")).toBeTruthy();

    fillEmail("applicant@example.com");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "orioles" } });
    type(/tell us about your collection/i, "I have every Orioles bobblehead.");
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => expect(sendInboundMessage).toHaveBeenCalledTimes(1));
    expect(messageAdmin).not.toHaveBeenCalled();
  });
});
