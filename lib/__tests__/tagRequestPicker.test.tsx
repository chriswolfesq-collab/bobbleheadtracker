// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TagList } from "@/components/TagList";

// The rep's side of the picker: the same control, wired to a request instead of
// a write. What's covered is that a rep can't reach the admin's writes from the
// UI at all, that submitting files a request, and that their pending asks are
// visible to them while they wait. The admin's path is tagDuplicateWarning.tsx.

const addTag = vi.fn<(label: string) => Promise<boolean>>();
const removeTag = vi.fn();
const requestTag = vi.fn<(label: string) => Promise<boolean>>();

let pending: { slug: string; label: string }[] = [];

vi.mock("@/lib/adminAuth", () => ({
  // A rep: trusted on this team, but not the admin.
  useAdminAuth: () => ({ isAdmin: false, canEditTeam: () => true }),
}));

vi.mock("@/lib/useTags", () => ({
  useBobbleheadTags: () => ({
    tags: [{ slug: "star-wars", label: "Star Wars" }],
    isLoading: false,
    addTag: (label: string) => addTag(label),
    removeTag,
  }),
  useTagVocabulary: () => ({
    tags: [{ slug: "peanuts", label: "Peanuts", listingCount: 4 }],
    isLoading: false,
    reload: vi.fn(),
  }),
  useMyTagRequests: () => ({ pending, requestTag: (label: string) => requestTag(label) }),
}));

beforeEach(() => {
  addTag.mockReset().mockResolvedValue(true);
  removeTag.mockReset();
  requestTag.mockReset().mockResolvedValue(true);
  pending = [];
});

afterEach(cleanup);

const openPicker = () => {
  render(<TagList teamSlug="dodgers" bobbleheadId="grogu-2023" />);
  fireEvent.click(screen.getByRole("button", { name: "Request a tag" }));
};

describe("a team rep's tag controls", () => {
  it("offers to request rather than to edit", () => {
    render(<TagList teamSlug="dodgers" bobbleheadId="grogu-2023" />);

    expect(screen.getByRole("button", { name: "Request a tag" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("files a request instead of writing the tag", async () => {
    openPicker();
    fireEvent.change(screen.getByLabelText("Request a tag"), {
      target: { value: "Sugar Skull" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request" }));

    await waitFor(() => expect(requestTag).toHaveBeenCalledWith("Sugar Skull"));
    // The whole point: a rep's gesture must not reach the vocabulary.
    expect(addTag).not.toHaveBeenCalled();
  });

  // The × on a chip is the admin's; a rep who could strip an approved tag could
  // undo the review the queue exists for.
  it("gives a rep no way to remove an existing tag", () => {
    openPicker();

    expect(screen.queryByRole("button", { name: /Remove the/ })).toBeNull();
    expect(removeTag).not.toHaveBeenCalled();
  });

  it("shows the rep their own asks as pending while they wait", () => {
    pending = [{ slug: "sugar-skull", label: "Sugar Skull" }];
    render(<TagList teamSlug="dodgers" bobbleheadId="grogu-2023" />);

    expect(screen.getByText("Sugar Skull")).toBeDefined();
    expect(screen.getByText(/pending/)).toBeDefined();
  });
});
