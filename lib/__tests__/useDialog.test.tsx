// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDialog } from "@/lib/useDialog";

afterEach(cleanup);

// A minimal dialog wired with useDialog, plus a button rendered before it so we
// can assert focus is restored to the opener when the dialog unmounts.
function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div>
      <button type="button" data-testid="opener">
        open
      </button>
      {open ? <Dialog onClose={onClose} /> : null}
    </div>
  );
}

function Dialog({ onClose }: { onClose: () => void }) {
  const ref = useDialog<HTMLDivElement>(true, onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Test dialog">
      <button type="button" data-testid="first">
        first
      </button>
      <button type="button" data-testid="last">
        last
      </button>
    </div>
  );
}

describe("useDialog", () => {
  it("moves focus to the first focusable element on open", () => {
    const { getByTestId } = render(<Harness open onClose={() => {}} />);
    expect(document.activeElement).toBe(getByTestId("first"));
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    const { getByRole } = render(<Harness open onClose={onClose} />);
    fireEvent.keyDown(getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps Tab from the last focusable back to the first", () => {
    const { getByTestId, getByRole } = render(<Harness open onClose={() => {}} />);
    getByTestId("last").focus();
    fireEvent.keyDown(getByRole("dialog"), { key: "Tab" });
    expect(document.activeElement).toBe(getByTestId("first"));
  });

  it("wraps Shift+Tab from the first focusable to the last", () => {
    const { getByTestId, getByRole } = render(<Harness open onClose={() => {}} />);
    getByTestId("first").focus();
    fireEvent.keyDown(getByRole("dialog"), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(getByTestId("last"));
  });

  it("restores focus to the opener when the dialog closes", () => {
    const { getByTestId, rerender } = render(<Harness open={false} onClose={() => {}} />);
    getByTestId("opener").focus();
    expect(document.activeElement).toBe(getByTestId("opener"));

    rerender(<Harness open onClose={() => {}} />);
    expect(document.activeElement).toBe(getByTestId("first"));

    rerender(<Harness open={false} onClose={() => {}} />);
    expect(document.activeElement).toBe(getByTestId("opener"));
  });
});
