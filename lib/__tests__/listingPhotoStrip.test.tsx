// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListingPhotoStrip, type StripPhoto } from "@/components/ListingPhotoStrip";

// Two reps reported the same round trip for a wrong photo: open the edit
// dialog, remove the photo, reopen the dialog, upload the new one — and again
// for the stock photo underneath. The fix puts every photo's controls on the
// strip under the big picture, which means the strip has to know what each
// thumbnail actually is. That's what these pin: a gallery row takes all three
// buttons, the profile photo can't be promoted to itself, the seed underneath
// can only be cleared, and a locked photo takes no controls at all.

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ openAuthModal: () => {} }),
}));

const VOTES = {
  votesByUrl: {},
  myVoteUrl: null,
  isLoggedIn: false,
  toggleVote: () => {},
};

const GALLERY_PHOTO = {
  id: "photo-1",
  imageUrl: "https://example.com/gallery.jpg",
  createdAt: "2026-01-01T00:00:00Z",
};

const MAIN: StripPhoto = { url: "https://example.com/main.jpg", kind: "main" };
const SEED: StripPhoto = { url: "https://example.com/seed.jpg", kind: "underlay" };
const GALLERY: StripPhoto = {
  url: GALLERY_PHOTO.imageUrl,
  kind: "gallery",
  photo: GALLERY_PHOTO,
};

afterEach(cleanup);

type StripHandlers = {
  onSetAsMain?: (photo: StripPhoto) => void;
  onReplace?: (photo: StripPhoto, file: File) => void;
  onRemove?: (photo: StripPhoto) => void;
};

function renderStrip(photos: StripPhoto[], handlers: StripHandlers = {}) {
  return render(
    <ListingPhotoStrip
      photos={photos}
      selectedUrl={photos[0]?.url ?? null}
      onSelect={() => {}}
      votes={VOTES}
      isManaging
      currentMainUrl={MAIN.url}
      onSetAsMain={handlers.onSetAsMain}
      onReplace={handlers.onReplace}
      onRemove={handlers.onRemove}
    />,
  );
}

describe("listing photo strip controls", () => {
  it("gives a gallery photo all three controls", () => {
    renderStrip([GALLERY], { onSetAsMain: vi.fn(), onReplace: vi.fn(), onRemove: vi.fn() });

    expect(screen.getByRole("button", { name: "Main" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Swap" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDefined();
  });

  it("labels the profile photo rather than offering to promote it", () => {
    renderStrip([MAIN], { onSetAsMain: vi.fn(), onReplace: vi.fn(), onRemove: vi.fn() });

    expect(screen.queryByRole("button", { name: "Main" })).toBeNull();
    expect(screen.getByText("Main")).toBeDefined();
    expect(screen.getByRole("button", { name: "Swap" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDefined();
  });

  it("lets the seed photo underneath be promoted or cleared, but not swapped", () => {
    renderStrip([MAIN, SEED], { onSetAsMain: vi.fn(), onReplace: vi.fn(), onRemove: vi.fn() });

    // One Swap (the profile photo's) — the seed has none, since uploading over
    // it would just write the profile photo.
    expect(screen.getAllByRole("button", { name: "Swap" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
    // The seed's — the profile photo shows a label instead.
    expect(screen.getAllByRole("button", { name: "Main" })).toHaveLength(1);
  });

  it("promotes the photo it was asked about", () => {
    const onSetAsMain = vi.fn();
    renderStrip([MAIN, SEED], { onSetAsMain });

    fireEvent.click(screen.getByRole("button", { name: "Main" }));

    expect(onSetAsMain).toHaveBeenCalledWith(SEED);
  });

  it("removes the photo it was asked about, after the confirmation", () => {
    const onRemove = vi.fn();
    renderStrip([SEED], { onRemove });

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onRemove).toHaveBeenCalledWith(SEED);
  });

  it("still promotes a photo that can't be removed on its own", () => {
    const onSetAsMain = vi.fn();
    renderStrip([{ ...SEED, removable: false }], { onSetAsMain, onRemove: vi.fn() });

    // Removing this one would take the photo layered above it too, so there's
    // no Remove — but making it the main photo only drops that layer.
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.getByRole("button", { name: "Main" })).toBeDefined();
  });

  it("shows no controls at all when management is off", () => {
    render(
      <ListingPhotoStrip
        photos={[MAIN, GALLERY]}
        selectedUrl={MAIN.url}
        onSelect={() => {}}
        votes={VOTES}
        onSetAsMain={vi.fn()}
        onReplace={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Swap" })).toBeNull();
  });
});
