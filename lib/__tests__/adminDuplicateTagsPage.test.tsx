// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminDuplicateTagsPage from "@/app/admin/duplicate-tags/page";
import type { ReviewablePair } from "@/lib/useTagDuplicates";

// The review queue. The pairs and the writes are stubbed; what's covered is who
// gets in, what each control does with the pair it belongs to, and that a
// missing migration reads as a setup note rather than a broken page.

const mergeTags = vi.fn();
const dismiss = vi.fn();
const restore = vi.fn();
const reload = vi.fn();

let isAdmin = true;
let needsSetup = false;
let open: ReviewablePair[] = [];
let dismissed: ReviewablePair[] = [];

const tag = (slug: string, label: string, listingCount: number) => ({ slug, label, listingCount });

const DAY = 86_400_000;

const pair = (overrides: Partial<ReviewablePair> = {}): ReviewablePair => ({
  a: tag("all-star", "All-Star", 40),
  b: tag("all-star-game", "All Star Game", 1),
  reason: "overlap",
  key: "all-star|all-star-game",
  newerCreatedAt: new Date(Date.now() - 2 * DAY).toISOString(),
  dismissedAt: null,
  ...overrides,
});

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

vi.mock("@/lib/adminTags", () => ({ mergeTags: (...args: unknown[]) => mergeTags(...args) }));

vi.mock("@/lib/useTagDuplicates", async (importOriginal) => ({
  // daysSince is a pure helper the page also imports; only the hook is replaced.
  ...(await importOriginal<typeof import("@/lib/useTagDuplicates")>()),
  useTagDuplicates: () => ({
    open,
    dismissed,
    isLoading: false,
    needsSetup,
    dismiss,
    restore,
    reload,
  }),
}));

beforeEach(() => {
  mergeTags.mockReset().mockResolvedValue({ error: null, moved: 1 });
  dismiss.mockReset().mockResolvedValue({ error: null });
  restore.mockReset().mockResolvedValue({ error: null });
  reload.mockReset();
  isAdmin = true;
  needsSetup = false;
  open = [pair()];
  dismissed = [];
});

afterEach(cleanup);

describe("who can review", () => {
  it("turns away an account that isn't a full admin", () => {
    isAdmin = false;
    render(<AdminDuplicateTagsPage />);

    expect(screen.getByText("Not authorized")).toBeDefined();
    expect(screen.queryByText("All Star Game")).toBeNull();
  });
});

describe("reviewing a pair", () => {
  it("shows both tags, why they matched, and how new it is", () => {
    render(<AdminDuplicateTagsPage />);

    expect(screen.getByText("All-Star")).toBeDefined();
    expect(screen.getByText("All Star Game")).toBeDefined();
    expect(screen.getByText("one name inside the other")).toBeDefined();
    expect(screen.getByText(/newer one added 2 days ago/)).toBeDefined();
    expect(screen.getByText("New")).toBeDefined();
  });

  // The badge is the alert, so it has to stop being one eventually.
  it("stops calling a pair new once it's been sitting there", () => {
    open = [pair({ newerCreatedAt: new Date(Date.now() - 60 * DAY).toISOString() })];
    render(<AdminDuplicateTagsPage />);

    expect(screen.queryByText("New")).toBeNull();
    expect(screen.getByText(/newer one added 60 days ago/)).toBeDefined();
  });

  // Which one survives is the admin's call: usually the bigger tag, but not
  // when the bigger one is the one spelled wrong.
  it("merges in whichever direction was chosen", async () => {
    render(<AdminDuplicateTagsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Keep All-Star" }));
    await waitFor(() =>
      expect(mergeTags).toHaveBeenCalledWith(expect.anything(), {
        fromSlug: "all-star-game",
        intoSlug: "all-star",
        createdBy: "admin-1",
      }),
    );

    mergeTags.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Keep All Star Game" }));
    await waitFor(() =>
      expect(mergeTags).toHaveBeenCalledWith(expect.anything(), {
        fromSlug: "all-star",
        intoSlug: "all-star-game",
        createdBy: "admin-1",
      }),
    );
  });

  it("records a pair that turns out to be two real tags", async () => {
    render(<AdminDuplicateTagsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Not a duplicate" }));

    await waitFor(() => expect(dismiss).toHaveBeenCalledWith(open[0]));
    expect(await screen.findByText(/won't be flagged again/)).toBeDefined();
  });

  it("surfaces a failed write rather than claiming it worked", async () => {
    mergeTags.mockResolvedValue({ error: "denied", moved: 0 });
    render(<AdminDuplicateTagsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Keep All-Star" }));

    expect(await screen.findByText("denied")).toBeDefined();
    expect(reload).not.toHaveBeenCalled();
  });

  it("says so when there's nothing to review", () => {
    open = [];
    render(<AdminDuplicateTagsPage />);

    expect(screen.getByText(/No two tags in the vocabulary look like the same thing/)).toBeDefined();
  });
});

describe("pairs already ruled on", () => {
  it("keeps them out of the way but puts them back on request", async () => {
    const ruled = pair({
      a: tag("dog", "Dogs", 20),
      b: tag("hot-dog", "Hot Dogs", 3),
      key: "dog|hot-dog",
      dismissedAt: new Date().toISOString(),
    });
    open = [];
    dismissed = [ruled];
    render(<AdminDuplicateTagsPage />);

    expect(screen.queryByText("Hot Dogs")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Show 1 already reviewed/ }));
    const row = screen.getAllByRole("listitem")[0];
    expect(within(row).getByText("Marked as two different tags.")).toBeDefined();

    fireEvent.click(within(row).getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith(ruled));
  });
});

describe("before the migration has been run", () => {
  it("still lists the pairs and says what's missing", () => {
    needsSetup = true;
    render(<AdminDuplicateTagsPage />);

    expect(screen.getByText(/tag_duplicates\.sql/)).toBeDefined();
    expect(screen.getByText("All Star Game")).toBeDefined();
  });
});
