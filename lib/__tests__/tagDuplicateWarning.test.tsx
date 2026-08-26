// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TagList } from "@/components/TagList";

// The question the picker asks before it mints a near-duplicate. Everything
// behind it is stubbed — what's covered is whether the warning appears when it
// should, what each answer does, and that nothing is written while it's up.
//
// Signed in as the admin, who is the only one who can mint now. A label the
// vocabulary already has isn't minted at all — it's applied — so those cases
// land on applyTag. The rep's side of the same picker is repTagRemoval.test.tsx
// and the plain requester's is tagRequestPicker.test.tsx.

const createTag = vi.fn<(label: string) => Promise<boolean>>();
const applyTag = vi.fn<(tag: { slug: string; label: string }) => Promise<boolean>>();
const reload = vi.fn();

const VOCABULARY = [
  { slug: "sugar-skull", label: "Sugar Skull", listingCount: 12 },
  { slug: "star-wars", label: "Star Wars", listingCount: 138 },
];

vi.mock("@/lib/adminAuth", () => ({
  useAdminAuth: () => ({ isAdmin: true, canEditTeam: () => true }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "admin-1" } }),
}));

vi.mock("@/lib/useTags", () => ({
  useBobbleheadTags: () => ({
    tags: [],
    isLoading: false,
    applyTag: (tag: { slug: string; label: string }) => applyTag(tag),
    createTag: (label: string) => createTag(label),
    removeTag: vi.fn(),
  }),
  useTagVocabulary: () => ({ tags: VOCABULARY, isLoading: false, reload }),
  useMyTagRequests: () => ({ pending: [], requestTag: vi.fn() }),
}));

beforeEach(() => {
  createTag.mockReset().mockResolvedValue(true);
  applyTag.mockReset().mockResolvedValue(true);
  reload.mockReset();
});

afterEach(cleanup);

// The picker only exists behind the Edit toggle.
const openPicker = () => {
  render(<TagList teamSlug="dodgers" bobbleheadId="grogu-2023" />);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
};

const type = (text: string) =>
  fireEvent.change(screen.getByLabelText("Add a tag"), { target: { value: text } });

describe("minting a tag the vocabulary may already cover", () => {
  it("asks instead of creating it", async () => {
    openPicker();
    type("Sugar Skulls");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText(/looks like it's already covered/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Use Sugar Skull/ })).toBeDefined();
    // Nothing is written while the question is open — that's the whole point of
    // asking before minting rather than cleaning up after.
    expect(createTag).not.toHaveBeenCalled();
    expect(applyTag).not.toHaveBeenCalled();
  });

  it("applies the existing tag when that's what was meant", async () => {
    openPicker();
    type("Sugar Skulls");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(await screen.findByRole("button", { name: /Use Sugar Skull/ }));

    await waitFor(() =>
      expect(applyTag).toHaveBeenCalledWith({ slug: "sugar-skull", label: "Sugar Skull" }),
    );
  });

  // Two tags that look alike sometimes are two tags, and whoever is holding the
  // bobblehead knows better than the matcher.
  it("still lets it through when the answer is that they meant it", async () => {
    openPicker();
    type("Sugar Skulls");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(await screen.findByRole("button", { name: /Create Sugar Skulls anyway/ }));

    await waitFor(() => expect(createTag).toHaveBeenCalledWith("Sugar Skulls"));
  });

  it("drops the question if the text changes under it", async () => {
    openPicker();
    type("Sugar Skulls");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/looks like it's already covered/)).toBeDefined();

    type("Turn Ahead the Clock");

    expect(screen.queryByText(/looks like it's already covered/)).toBeNull();
  });

  it("doesn't ask about a tag nothing resembles", async () => {
    openPicker();
    type("Turn Ahead the Clock");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(createTag).toHaveBeenCalledWith("Turn Ahead the Clock"));
    expect(screen.queryByText(/looks like it's already covered/)).toBeNull();
  });

  // Clicking a suggestion is applying a tag that exists, not minting one.
  it("doesn't ask when an existing tag is picked from the suggestions", async () => {
    openPicker();
    type("star");
    fireEvent.click(screen.getByRole("button", { name: /Star Wars/ }));

    await waitFor(() =>
      expect(applyTag).toHaveBeenCalledWith({ slug: "star-wars", label: "Star Wars" }),
    );
    expect(screen.queryByText(/looks like it's already covered/)).toBeNull();
  });
});
