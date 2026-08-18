// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminMessagesPage from "@/app/admin/messages/page";

// Answering an inbound message from the console. The two halves are separate on
// purpose — the email leaves through admin-send-email, the text is written down
// through an RPC — so what's covered here is that the draft opens with the
// sender's own message in it, that the address it goes to is the one on the row,
// and that a failure to record it doesn't read as a failure to send it.

const sendAdminEmail = vi.fn();
const rpc = vi.fn();

let isAdmin = true;

type Reply = { id: string; body: string; sent_to: string; created_at: string };

const message = (overrides: Record<string, unknown> = {}) => ({
  id: "m-1",
  kind: "contact",
  name: "Dana",
  email: "dana@example.com",
  team_slug: null,
  message: "Do you have the 1997 Astros set?\nThanks!",
  status: "new",
  created_at: "2026-08-10T15:00:00.000Z",
  handled_at: null,
  replies: [] as Reply[],
  ...overrides,
});

let rows: Record<string, unknown>[] = [message()];

vi.mock("@/components/Breadcrumbs", () => ({ Breadcrumbs: () => null }));
vi.mock("@/components/AdminLoginForm", () => ({ AdminLoginForm: () => <p>Sign in to continue</p> }));

vi.mock("@/lib/adminAuth", () => ({
  useAdminAuth: () => ({
    user: { id: "admin-1", email: "chris@example.com" },
    isAdmin,
    isLoading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/adminEmail", () => ({
  sendAdminEmail: (...args: unknown[]) => sendAdminEmail(...args),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: { rpc: (...args: unknown[]) => rpc(...args) },
}));

beforeEach(() => {
  isAdmin = true;
  rows = [message()];
  sendAdminEmail.mockReset().mockResolvedValue({ sent: 1 });
  rpc.mockReset().mockImplementation((name: string) =>
    Promise.resolve(
      name === "admin_list_inbound_messages" ? { data: rows, error: null } : { data: null, error: null },
    ),
  );
});

afterEach(cleanup);

const openDraft = async () => {
  render(<AdminMessagesPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Reply" }));
  const [subject, body] = screen.getAllByRole("textbox");
  return { subject: subject as HTMLInputElement, body: body as HTMLTextAreaElement };
};

const callsTo = (name: string) => rpc.mock.calls.filter(([called]) => called === name);

describe("opening a reply", () => {
  it("prefills the subject and quotes what they wrote", async () => {
    const { subject, body } = await openDraft();

    expect(subject.value).toBe("Re: your message to Bobble Shelf");
    expect(body.value).toContain("> Do you have the 1997 Astros set?");
    expect(body.value).toContain("> Thanks!");
    // Room to type above the quote, not after it.
    expect(body.value.startsWith("\n")).toBe(true);
  });

  it("names the team when the message is a rep application", async () => {
    rows = [message({ kind: "rep_application", team_slug: "orioles" })];
    const { subject } = await openDraft();

    expect(subject.value).toBe("Re: your Orioles team rep application");
  });
});

describe("sending a reply", () => {
  it("emails the address on the row and records what went out", async () => {
    const { body } = await openDraft();
    fireEvent.change(body, { target: { value: "Yes — three of them." } });
    fireEvent.click(screen.getByRole("button", { name: /send email/i }));

    await waitFor(() => expect(sendAdminEmail).toHaveBeenCalledTimes(1));
    expect(sendAdminEmail).toHaveBeenCalledWith({
      subject: "Re: your message to Bobble Shelf",
      body: "Yes — three of them.",
      recipientEmails: ["dana@example.com"],
    });

    await waitFor(() => expect(callsTo("admin_record_inbound_reply")).toHaveLength(1));
    expect(callsTo("admin_record_inbound_reply")[0][1]).toEqual({
      p_message_id: "m-1",
      p_body: "Yes — three of them.",
    });
    // The queue is re-read, so the reply and the handled state both show up.
    await waitFor(() => expect(callsTo("admin_list_inbound_messages").length).toBeGreaterThan(1));
    expect(await screen.findByText(/Replied to Dana/)).toBeTruthy();
  });

  it("never records a reply the mailer refused", async () => {
    sendAdminEmail.mockRejectedValue(new Error("Resend error: sender not verified"));
    const { body } = await openDraft();
    fireEvent.change(body, { target: { value: "Yes — three of them." } });
    fireEvent.click(screen.getByRole("button", { name: /send email/i }));

    expect(await screen.findByText(/sender not verified/)).toBeTruthy();
    expect(callsTo("admin_record_inbound_reply")).toHaveLength(0);
  });

  // The mail is gone by the time the RPC runs, so this is the one error that
  // must not read as "your reply didn't go out."
  it("says the reply was sent when only saving it fails", async () => {
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === "admin_record_inbound_reply"
          ? { data: null, error: { message: "message not found" } }
          : { data: rows, error: null },
      ),
    );

    const { body } = await openDraft();
    fireEvent.change(body, { target: { value: "Yes — three of them." } });
    fireEvent.click(screen.getByRole("button", { name: /send email/i }));

    const warning = await screen.findByText(/Your reply was sent to dana@example.com/);
    expect(warning.textContent).toContain("message not found");
  });
});

describe("a message that's been answered", () => {
  it("shows the reply and offers to reply again", async () => {
    rows = [
      message({
        status: "handled",
        handled_at: "2026-08-11T15:00:00.000Z",
        replies: [
          {
            id: "r-1",
            body: "Yes — three of them.",
            sent_to: "dana@example.com",
            created_at: "2026-08-11T15:00:00.000Z",
          },
        ],
      }),
    ];
    render(<AdminMessagesPage />);

    expect(await screen.findByText("Replied")).toBeTruthy();
    expect(screen.getByText("Yes — three of them.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reply again" })).toBeTruthy();
  });
});
