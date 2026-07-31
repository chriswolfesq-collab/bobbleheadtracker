// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminTagsPage from "@/app/admin/tags/page";

// The admin's view of the vocabulary. Only an admin account can reach it, so
// the auth context and the three writes are stubbed and what's exercised is the
// page: who it lets in, what it warns before a delete, and which write each
// control ends up calling.

const renameTag = vi.fn();
const deleteTag = vi.fn();
const mergeTags = vi.fn();
const reload = vi.fn();

let isAdmin = true;
let user: { id: string; email: string } | null = { id: "admin-1", email: "chris@example.com" };

const TAGS = [
  { slug: "all-star", label: "All-Star", listingCount: 40 },
  { slug: "all-star-game", label: "All Star Game", listingCount: 1 },
  { slug: "unused", label: "Unused", listingCount: 0 },
];

vi.mock("@/components/Breadcrumbs", () => ({ Breadcrumbs: () => null }));
vi.mock("@/components/AdminLoginForm", () => ({ AdminLoginForm: () => <p>Sign in to continue</p> }));

vi.mock("@/lib/adminAuth", () => ({
  useAdminAuth: () => ({ user, isAdmin, isLoading: false, signOut: vi.fn() }),
}));

vi.mock("@/lib/useTags", () => ({
  useTagVocabulary: () => ({ tags: TAGS, isLoading: false, reload }),
}));

vi.mock("@/lib/adminTags", () => ({
  renameTag: (...args: unknown[]) => renameTag(...args),
  deleteTag: (...args: unknown[]) => deleteTag(...args),
  mergeTags: (...args: unknown[]) => mergeTags(...args),
}));

beforeEach(() => {
  renameTag.mockReset().mockResolvedValue({ error: null });
  deleteTag.mockReset().mockResolvedValue({ error: null });
  mergeTags.mockReset().mockResolvedValue({ error: null, moved: 1 });
  reload.mockReset();
  isAdmin = true;
  user = { id: "admin-1", email: "chris@example.com" };
});

afterEach(cleanup);

const row = (label: string) =>
  screen.getAllByRole("listitem").find((item) => item.textContent?.startsWith(label))!;

describe("who can edit the vocabulary", () => {
  it("turns away a signed-in account that isn't an admin", () => {
    isAdmin = false;
    render(<AdminTagsPage />);

    expect(screen.getByText("Not authorized")).toBeDefined();
    expect(screen.queryByText("All-Star")).toBeNull();
  });

  it("asks a signed-out visitor to log in", () => {
    user = null;
    isAdmin = false;
    render(<AdminTagsPage />);

    expect(screen.getByText("Sign in to continue")).toBeDefined();
  });
});

describe("editing the vocabulary", () => {
  it("lists every tag, including the ones nothing carries", () => {
    render(<AdminTagsPage />);

    expect(screen.getByText("Unused")).toBeDefined();
    expect(row("Unused").textContent).toContain("0 listings");
  });

  it("renames one", async () => {
    render(<AdminTagsPage />);

    fireEvent.click(within(row("All Star Game")).getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByDisplayValue("All Star Game"), {
      target: { value: "All-Star Game" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));

    await waitFor(() =>
      expect(renameTag).toHaveBeenCalledWith(expect.anything(), "all-star-game", "All-Star Game"),
    );
    expect(reload).toHaveBeenCalled();
  });

  // The count is the whole point of the confirmation: deleting cascades to the
  // assignments, so an admin should see what it costs before they agree to it.
  it("says how many listings a delete would strip before doing it", async () => {
    render(<AdminTagsPage />);

    fireEvent.click(within(row("All-Star")).getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/takes the tag off all 40 listings/)).toBeDefined();
    expect(deleteTag).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Delete All-Star/ }));

    await waitFor(() => expect(deleteTag).toHaveBeenCalledWith(expect.anything(), "all-star"));
  });

  it("merges one into another and says how many moved", async () => {
    render(<AdminTagsPage />);

    fireEvent.click(within(row("All Star Game")).getByRole("button", { name: "Merge" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "all-star" } });
    fireEvent.click(screen.getByRole("button", { name: "Merge and delete" }));

    await waitFor(() =>
      expect(mergeTags).toHaveBeenCalledWith(expect.anything(), {
        fromSlug: "all-star-game",
        intoSlug: "all-star",
        createdBy: "admin-1",
      }),
    );
    expect(await screen.findByText(/Merged All Star Game into All-Star — 1 listing moved/)).toBeDefined();
  });

  it("offers every other tag to merge into, but not itself", () => {
    render(<AdminTagsPage />);

    fireEvent.click(within(row("All-Star")).getByRole("button", { name: "Merge" }));
    const options = within(screen.getByRole("combobox"))
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(options).toEqual(["Pick a tag…", "All Star Game (1)", "Unused (0)"]);
  });

  it("surfaces a failed write instead of reporting success", async () => {
    deleteTag.mockResolvedValue({ error: "your admin access may have expired" });
    render(<AdminTagsPage />);

    fireEvent.click(within(row("Unused")).getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: /Delete Unused/ }));

    expect(await screen.findByText(/admin access may have expired/)).toBeDefined();
    expect(reload).not.toHaveBeenCalled();
  });

  it("filters the list", () => {
    render(<AdminTagsPage />);

    fireEvent.change(screen.getByPlaceholderText("Filter tags…"), { target: { value: "all star" } });

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("Unused")).toBeNull();
  });
});
