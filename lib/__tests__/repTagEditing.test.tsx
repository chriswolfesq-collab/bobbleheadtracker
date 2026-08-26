// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TagList } from "@/components/TagList";

// A team rep's tag controls, which are cut along mint/apply rather than
// add/remove. On their own team's listing they put an approved tag on and take
// one off directly; a label the vocabulary doesn't have yet is still a request
// for the admin. On anyone else's listing they're a plain requester.
//
// The admin's path is tagDuplicateWarning.test.tsx; the non-rep's is
// tagRequestPicker.test.tsx.

const createTag = vi.fn<(label: string) => Promise<boolean>>();
const applyTag = vi.fn<(tag: { slug: string; label: string }) => Promise<boolean>>();
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
    applyTag: (tag: { slug: string; label: string }) => applyTag(tag),
    createTag: (label: string) => createTag(label),
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
  createTag.mockReset().mockResolvedValue(true);
  applyTag.mockReset().mockResolvedValue(true);
  removeTag.mockReset().mockResolvedValue(true);
  requestTag.mockReset().mockResolvedValue(true);
});

afterEach(cleanup);

const openPicker = (teamSlug: string, control: string) => {
  render(<TagList teamSlug={teamSlug} bobbleheadId="grogu-2023" />);
  fireEvent.click(screen.getByRole("button", { name: control }));
};

describe("a team rep's tag controls", () => {
  it("lets the rep take a tag off their own team's listing", async () => {
    openPicker("dodgers", "Edit");
    fireEvent.click(screen.getByRole("button", { name: "Remove the Star Wars tag" }));

    await waitFor(() => expect(removeTag).toHaveBeenCalledWith("star-wars"));
  });

  // The change this file is named for: an approved label on one of their own
  // listings goes on, rather than queueing behind a review that already
  // happened when the label was minted.
  it("applies a tag the vocabulary already has, without asking", async () => {
    openPicker("dodgers", "Edit");
    fireEvent.click(screen.getByRole("button", { name: /Peanuts/ }));

    await waitFor(() =>
      expect(applyTag).toHaveBeenCalledWith({ slug: "peanuts", label: "Peanuts" }),
    );
    expect(requestTag).not.toHaveBeenCalled();
  });

  // Typing the name is picking it: same tag, same one-click path, and the
  // vocabulary's casing is what gets written rather than what was typed.
  it("applies it when the rep types the name instead of clicking it", async () => {
    openPicker("dodgers", "Edit");
    fireEvent.change(screen.getByLabelText("Add a tag"), { target: { value: "peanuts" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(applyTag).toHaveBeenCalledWith({ slug: "peanuts", label: "Peanuts" }),
    );
  });

  // The half that stays reviewed: minting a label is a decision about all
  // thirty teams, so a rep asks for it like anybody else.
  it("files a request for a label the vocabulary doesn't have", async () => {
    openPicker("dodgers", "Edit");
    fireEvent.change(screen.getByLabelText("Add a tag"), { target: { value: "Sugar Skull" } });
    fireEvent.click(screen.getByRole("button", { name: "Request" }));

    await waitFor(() => expect(requestTag).toHaveBeenCalledWith("Sugar Skull"));
    expect(createTag).not.toHaveBeenCalled();
    expect(applyTag).not.toHaveBeenCalled();
  });

  // One control doing two things has to say which one it's about to do.
  it("says Add or Request depending on what's been typed", () => {
    openPicker("dodgers", "Edit");
    const input = screen.getByLabelText("Add a tag");

    fireEvent.change(input, { target: { value: "Peanuts" } });
    expect(screen.getByRole("button", { name: "Add" })).toBeDefined();

    fireEvent.change(input, { target: { value: "Sugar Skull" } });
    expect(screen.getByRole("button", { name: "Request" })).toBeDefined();
  });

  // Repping one team is not repping the league — both writes have to follow the
  // same team scope the policies do.
  it("gives the same rep only the request path on another team's listing", async () => {
    openPicker("padres", "Request a tag");

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove the/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Peanuts/ }));

    await waitFor(() => expect(requestTag).toHaveBeenCalledWith("Peanuts"));
    expect(applyTag).not.toHaveBeenCalled();
  });
});
