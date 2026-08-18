// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchListingToggle } from "@/components/SearchListingToggle";
import type { SearchListing } from "@/lib/profile";

// The switch is a promise about who can find you, so the copy is the feature as
// much as the column is. The one thing it must never imply is that turning it
// off makes the shelf private — shelves are public and there is no toggle for
// that, so a member who reads "hidden" as "dark" has been misled by us.

const showError = vi.fn();
vi.mock("@/components/Toast", () => ({ useToast: () => ({ showError }) }));

afterEach(() => {
  cleanup();
  showError.mockClear();
});

function listing(overrides: Partial<SearchListing> = {}): SearchListing {
  return {
    enabled: true,
    isLoading: false,
    isSaving: false,
    setEnabled: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

describe("SearchListingToggle", () => {
  it("renders nothing until the current setting is known", () => {
    const { container } = render(<SearchListingToggle listing={listing({ isLoading: true })} />);
    // A switch that paints "on" before loading tells half the members on this
    // site the opposite of the truth for a beat.
    expect(container.firstChild).toBeNull();
  });

  it("reports the switch state to assistive tech", () => {
    const { unmount } = render(<SearchListingToggle listing={listing()} />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    unmount();

    render(<SearchListingToggle listing={listing({ enabled: false })} />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("writes the opposite of the current value", () => {
    const setEnabled = vi.fn().mockResolvedValue({ error: null });
    render(<SearchListingToggle listing={listing({ enabled: true, setEnabled })} />);

    fireEvent.click(screen.getByRole("switch"));

    expect(setEnabled).toHaveBeenCalledWith(false);
  });

  it("surfaces a failed save instead of leaving a lie on screen", async () => {
    const setEnabled = vi.fn().mockResolvedValue({ error: "Couldn't update that. Try again." });
    render(<SearchListingToggle listing={listing({ setEnabled })} />);

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => expect(showError).toHaveBeenCalledWith("Couldn't update that. Try again."));
  });

  // The honesty tests. Off must promise no more than it delivers.
  it("says the shelf link still works when hidden, and doesn't claim privacy", () => {
    render(<SearchListingToggle listing={listing({ enabled: false })} />);

    const text = document.body.textContent ?? "";
    expect(text).toMatch(/won't turn up when collectors search by name/i);
    expect(text).toMatch(/shelf link can still open it/i);
    expect(text).toMatch(/hides you from search, not from the web/i);
    // Nothing here may read as "your shelf is now private".
    expect(text).not.toMatch(/private|nobody can see|invisible|hidden from everyone/i);
  });

  it("says what is on offer when listed, including that email never is", () => {
    render(<SearchListingToggle listing={listing({ enabled: true })} />);

    const text = document.body.textContent ?? "";
    expect(text).toMatch(/find you by name/i);
    expect(text).toMatch(/never your email/i);
  });
});
