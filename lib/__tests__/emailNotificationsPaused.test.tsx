// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailAlertsToggle } from "@/components/EmailAlertsToggle";
import type { EmailPreferences } from "@/lib/profile";

// The site-wide notification pause (supabase/notification_emails_off.sql).
// While it's off the database answers false to wants_email for every account and
// every kind, so the per-user switches decide nothing. What's under test is that
// Settings stops offering them: a toggle you can flip that changes nothing reads
// as a broken feature, and worse, as a promise of email that never comes.

vi.mock("@/components/Toast", () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

function prefs(overrides: Partial<EmailPreferences> = {}): EmailPreferences {
  return {
    values: {
      all: true,
      wanted_alerts: true,
      submission_updates: true,
      rep_digest: true,
      weekly_digest: true,
      forum_digest: true,
      messages: true,
    },
    isLoading: false,
    savingKind: null,
    isAdmin: true,
    isModerator: true,
    notificationsPaused: false,
    setPreference: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

afterEach(cleanup);

describe("EmailAlertsToggle while notifications are paused site-wide", () => {
  it("replaces every switch with a plain statement that nothing is sent", () => {
    render(<EmailAlertsToggle alerts={prefs({ notificationsPaused: true })} />);

    expect(
      screen.getByText(/doesn['’]t send notification emails/i),
    ).toBeTruthy();
    // Not one switch left — including the two an admin/moderator alone can see,
    // which is why this renders with both flags on.
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.queryByText(/Wanted alerts/i)).toBeNull();
    expect(screen.queryAllByText(/Team Rep Forum/i)).toHaveLength(0);
  });

  it("still tells people account email keeps working", () => {
    render(<EmailAlertsToggle alerts={prefs({ notificationsPaused: true })} />);

    // Signing up and resetting a password are Supabase Auth mail, untouched by
    // the switch. Someone reading "no emails" shouldn't conclude a password
    // reset won't reach them either.
    expect(screen.getByText(/password reset/i)).toBeTruthy();
  });

  it("shows the full set of switches again once the pause lifts", () => {
    // The stored preferences are never cleared, so turning the switch back on
    // has to restore the panel exactly — this is the assertion that would fail
    // if the paused branch had been written as a permanent removal.
    render(<EmailAlertsToggle alerts={prefs({ notificationsPaused: false })} />);

    expect(screen.getByRole("switch", { name: "Wanted alerts" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Team Rep Forum" })).toBeTruthy();
    // Master switch plus one per kind, both admin-only rows included.
    expect(screen.queryAllByRole("switch")).toHaveLength(7);
    expect(screen.queryByText(/doesn['’]t send notification emails/i)).toBeNull();
  });
});
