// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FriendShelfPanel } from "@/components/FriendShelfPanel";
import PublicGallery from "@/components/PublicGallery";
import { WantedListToggle } from "@/components/WantedListToggle";
import type { WantedSharing } from "@/lib/profile";
import type { PublicGalleryItem } from "@/lib/publicShelf";

// Publishing a wanted list turns a shelf link into a wish list someone outside
// the site can act on. Two things have to hold: the switch has to tell the
// truth about what it discloses, and a friend looking at a shelf that already
// publishes its wanted list must not be shown those cards a second time.

let friendItems: PublicGalleryItem[] = [];
const galleryCalls: PublicGalleryItem[][] = [];

const showError = vi.fn();
vi.mock("@/components/Toast", () => ({ useToast: () => ({ showError }) }));

afterEach(() => {
  cleanup();
  showError.mockClear();
  galleryCalls.length = 0;
});

function sharing(overrides: Partial<WantedSharing> = {}): WantedSharing {
  return {
    enabled: false,
    isLoading: false,
    isSaving: false,
    setEnabled: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

describe("WantedListToggle", () => {
  it("renders nothing until the current setting is known", () => {
    const { container } = render(<WantedListToggle wanted={sharing({ isLoading: true })} />);
    expect(container.firstChild).toBeNull();
  });

  it("reports the switch state to assistive tech", () => {
    const { unmount } = render(<WantedListToggle wanted={sharing({ enabled: true })} />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    unmount();

    render(<WantedListToggle wanted={sharing()} />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("writes the opposite of the current value", () => {
    const setEnabled = vi.fn().mockResolvedValue({ error: null });
    render(<WantedListToggle wanted={sharing({ enabled: false, setEnabled })} />);

    fireEvent.click(screen.getByRole("switch"));

    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  it("surfaces a failed save instead of leaving a lie on screen", async () => {
    const setEnabled = vi
      .fn()
      .mockResolvedValue({ error: "Couldn't update your wanted list. Try again." });
    render(<WantedListToggle wanted={sharing({ setEnabled })} />);

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith("Couldn't update your wanted list. Try again."),
    );
  });

  it("says the list goes out to anyone with the link, not just friends", () => {
    render(<WantedListToggle wanted={sharing({ enabled: true })} />);

    const text = document.body.textContent ?? "";
    expect(text).toMatch(/anyone with your link/i);
    // The one thing it must not imply is that this is a friends-only setting —
    // that's a different switch, and this one is genuinely public.
    expect(text).not.toMatch(/friends only|only friends/i);
  });
});

function item(kind: PublicGalleryItem["kind"], id: string): PublicGalleryItem {
  return {
    kind,
    bobbleheadId: id,
    teamSlug: "cubs",
    title: id,
    imageUrl: null,
    href: `/teams/cubs/bobbleheads/${id}`,
  };
}

describe("the public wanted section", () => {
  it("renders on its own, for a shelf that publishes nothing else", () => {
    render(<PublicGallery displayName="Dana" items={[item("wanted", "ryne-sandberg")]} />);

    expect(screen.getByText("Wanted")).toBeTruthy();
    // The visitor may never have used the site: say what the list is for.
    expect(document.body.textContent ?? "").toMatch(/still hunting for these/i);
    expect(screen.getByText("ryne-sandberg")).toBeTruthy();
  });

  // A wanted list is the one list people mark exhaustively — the longest on the
  // site is near a thousand items — so the shelf shows a preview and sends the
  // rest to its own page.
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => item("wanted", `wanted-${i}`));
  const cards = () =>
    screen.getAllByRole("link").filter((el) => el.getAttribute("href")?.includes("/bobbleheads/"));

  it("cuts a long list to a preview and links to the rest, counting the whole list", () => {
    render(
      <PublicGallery displayName="Dana" items={many(61)} wantedHref="/shelf/dana/wanted" />,
    );

    expect(cards()).toHaveLength(60);
    const seeAll = screen.getByRole("link", { name: /see all 61 wanted/i });
    expect(seeAll.getAttribute("href")).toBe("/shelf/dana/wanted");
    // The header count is the real total, not the number of cards on screen.
    expect(screen.getByText("61")).toBeTruthy();
  });

  it("leaves a list that fits alone, with nothing to click through to", () => {
    render(
      <PublicGallery displayName="Dana" items={many(60)} wantedHref="/shelf/dana/wanted" />,
    );

    expect(cards()).toHaveLength(60);
    expect(screen.queryByRole("link", { name: /see all/i })).toBeNull();
  });

  it("shows a friend the whole list, since their view has no page to link to", () => {
    // No wantedHref: these items are friend-only, so /shelf/dana/wanted would
    // 404 on them. Truncating with nowhere to go would just hide cards.
    render(<PublicGallery displayName="Dana" items={many(61)} />);

    expect(cards()).toHaveLength(61);
    expect(screen.queryByRole("link", { name: /see all/i })).toBeNull();
  });
});

vi.mock("@/components/PublicGallery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/PublicGallery")>();
  return {
    default: (props: { displayName: string; items: PublicGalleryItem[] }) => {
      galleryCalls.push(props.items);
      return actual.default(props);
    },
  };
});
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "viewer-1" }, openAuthModal: vi.fn() }),
}));
vi.mock("@/lib/messages", () => ({ startDirectConversation: vi.fn() }));
vi.mock("@/lib/friends", () => ({
  useFriendShelf: () => ({
    status: "friends",
    items: friendItems,
    isGalleryLoading: false,
    ownerSharesWithFriends: true,
    send: vi.fn(),
    accept: vi.fn(),
    cancel: vi.fn(),
  }),
}));

describe("a friend on a shelf that already publishes some of it", () => {
  it("is shown only the kinds the public page left out", () => {
    friendItems = [item("owned", "andre-dawson"), item("wanted", "ryne-sandberg")];

    // The wanted list is public here, so the server already put those cards on
    // the page above this panel.
    render(<FriendShelfPanel slug="dana" displayName="Dana" publicKinds={["wanted"]} />);

    expect(galleryCalls).toHaveLength(1);
    expect(galleryCalls[0].map((i) => i.bobbleheadId)).toEqual(["andre-dawson"]);
  });

  it("still gets the whole shelf when the public page showed none of it", () => {
    friendItems = [item("owned", "andre-dawson"), item("wanted", "ryne-sandberg")];

    render(<FriendShelfPanel slug="dana" displayName="Dana" publicKinds={[]} />);

    expect(galleryCalls[0].map((i) => i.bobbleheadId)).toEqual([
      "andre-dawson",
      "ryne-sandberg",
    ]);
  });
});
