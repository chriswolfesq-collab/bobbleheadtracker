// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TagList } from "@/components/TagList";

// A team rep's half-open controls: they can take a wrong tag off their own
// team's listing, but adding still files a request like anyone else's. The
// admin's path is tagDuplicateWarning.test.tsx; the plain requester's is
// tagRequestPicker.test.tsx.

const addTag = vi.fn<(label: string) => Promise<boolean>>();
const removeTag = vi.fn<(slug: string) => Promise<boolean>>();
const requestTag = vi.fn<(label: string) => Promise<boolean>>();

// Reps for the Dodgers and nobody else — the second team is what proves the
// grant is scoped rather than "is a rep anywhere".
vi.mock("@/lib/adminAuth", () => ({
  useAdminAuth: () => ({
    isAdmin: false,
    canEditTeam: (teamSlug: string) => teamSlug === "dodgers",
  }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "rep-1" } }),
}));

vi.mock("@/lib/useTags", () => ({
  useBobbleheadTags: () => ({
    tags: [{ slug: "star-wars", label: "Star Wars" }],
    isLoading: false,
    addTag: (label: string) => addTag(label),
    removeTag: (slug: string) => removeTag(slug),
  }),
  useTagVocabulary: () => ({
    tags: [{ slug: "peanuts", label: "Peanuts", listingCount: 4 }],
    isLoading: false,
    reload: vi.fn(),
  }),
  useMyTagRequests: () => ({ pending: [], requestTag: (label: string) => requestTag(label) }),
}));

beforeEach(() => {
  addTag.mockReset().mockResolvedValue(true);
  removeTag.mockReset().mockResolvedValue(true);
  requestTag.mockReset().mockResolvedValue(true);
});

afterEach(cleanup);

describe("a team rep's tag controls", () => {
  it("lets the rep take a tag off their own team's listing", async () => {
    render(<TagList teamSlug="dodgers" bobbleheadId="grogu-2023" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove the Star Wars tag" }));

    await waitFor(() => expect(removeTag).toHaveBeenCalledWith("star-wars"));
  });

  // The asymmetry this whole change rests on: removal is the rep's, minting and
  // applying stay the admin's.
  it("still files a request when the rep adds one", async () => {
    render(<TagList teamSlug="dodgers" bobbleheadId="grogu-2023" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Request a tag"), {
      target: { value: "Sugar Skull" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request" }));

    await waitFor(() => expect(requestTag).toHaveBeenCalledWith("Sugar Skull"));
    expect(addTag).not.toHaveBeenCalled();
  });

  // Repping one team is not repping the league — the × has to follow the same
  // team scope the delete policy does.
  it("gives the same rep no × on another team's listing", () => {
    render(<TagList teamSlug="padres" bobbleheadId="grogu-2023" />);

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Request a tag" }));
    expect(screen.queryByRole("button", { name: /Remove the/ })).toBeNull();
  });
});
