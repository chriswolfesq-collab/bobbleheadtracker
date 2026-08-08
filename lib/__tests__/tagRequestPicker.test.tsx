// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TagList } from "@/components/TagList";

// The requester's side of the picker: the same control, wired to a request
// instead of a write. What's covered is that nobody but the admin can reach the
// writes from the UI, that asking isn't gated on being the team's rep, and that
// a requester can see their own asks while they wait. The admin's path is
// tagDuplicateWarning.test.tsx.

const addTag = vi.fn<(label: string) => Promise<boolean>>();
const removeTag = vi.fn();
const requestTag = vi.fn<(label: string) => Promise<boolean>>();

let pending: { slug: string; label: string }[] = [];
let user: { id: string } | null = { id: "user-1" };

vi.mock("@/lib/adminAuth", () => ({
  // Signed in, not the admin, and not this team's rep either — the case that
  // used to see no controls at all.
  useAdminAuth: () => ({ isAdmin: false, canEditTeam: () => false }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user }),
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
  user = { id: "user-1" };
});

afterEach(cleanup);

const openPicker = () => {
  render(<TagList teamSlug="dodgers" bobbleheadId="grogu-2023" />);
  fireEvent.click(screen.getByRole("button", { name: "Request a tag" }));
};

describe("a signed-in user's tag controls", () => {
  // The point of opening this up: you don't have to rep the Dodgers to know a
  // Grogu bobblehead is a Star Wars bobblehead.
  it("offers to request even without rep rights on the team", () => {
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
    // The whole point: the gesture must not reach the vocabulary.
    expect(addTag).not.toHaveBeenCalled();
  });

  // The × on a chip is the admin's; anyone who could strip an approved tag
  // could undo the review the queue exists for.
  it("gives a requester no way to remove an existing tag", () => {
    openPicker();

    expect(screen.queryByRole("button", { name: /Remove the/ })).toBeNull();
    expect(removeTag).not.toHaveBeenCalled();
  });

  it("shows the requester their own asks as pending while they wait", () => {
    pending = [{ slug: "sugar-skull", label: "Sugar Skull" }];
    render(<TagList teamSlug="dodgers" bobbleheadId="grogu-2023" />);

    expect(screen.getByText("Sugar Skull")).toBeDefined();
    expect(screen.getByText(/pending/)).toBeDefined();
  });

  // A request has to be attributable to somebody, so the control is for signed-
  // in visitors only — a logged-out reader still sees the chips.
  it("offers a signed-out visitor nothing to click", () => {
    user = null;
    render(<TagList teamSlug="dodgers" bobbleheadId="grogu-2023" />);

    expect(screen.getByText("Star Wars")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Request a tag" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });
});
