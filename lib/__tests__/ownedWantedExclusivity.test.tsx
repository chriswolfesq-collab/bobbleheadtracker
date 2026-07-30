// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FavoritesProvider,
  GiveawayCard,
  OwnershipProvider,
  WantedProvider,
  type ResolvedGiveaway,
} from "@/app/teams/[slug]/GiveawayCard";
import { getTeamBySlug } from "@/lib/teams";

// Owning something and wanting it are contradictory states, and the card is
// where both switches sit next to each other. The three collection hooks are
// stubbed with in-memory maps so the test can watch what one click writes to
// the other flag — which is the whole behaviour under test.

const GIVEAWAY_ID = "billy-the-marlin-2014";

let owned: Record<string, boolean>;
let wanted: Record<string, boolean>;
const setOwned = vi.fn((id: string, value: boolean) => {
  owned = { ...owned, [id]: value };
});
const setWanted = vi.fn((id: string, value: boolean) => {
  wanted = { ...wanted, [id]: value };
});

vi.mock("@/lib/userCollections", () => ({
  useUserCollection: () => ({ ownedById: owned, isLoading: false, isLoggedIn: true, setOwned }),
}));
vi.mock("@/lib/userWanted", () => ({
  useUserWanted: () => ({ wantedById: wanted, isLoading: false, isLoggedIn: true, setWanted }),
}));
vi.mock("@/lib/userFavorites", () => ({
  useUserFavorites: () => ({
    favoritedById: {},
    isLoading: false,
    isLoggedIn: true,
    setFavorited: vi.fn(),
  }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ openAuthModal: vi.fn() }) }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

const giveaway: ResolvedGiveaway = {
  id: GIVEAWAY_ID,
  title: "Billy the Marlin",
  year: "2014",
  date: "August 17, 2014",
  source: "community",
};

const team = getTeamBySlug("marlins")!;

function renderCard() {
  return render(
    <OwnershipProvider teamSlug={team.slug}>
      <WantedProvider teamSlug={team.slug}>
        <FavoritesProvider teamSlug={team.slug}>
          <GiveawayCard giveaway={giveaway} team={team} />
        </FavoritesProvider>
      </WantedProvider>
    </OwnershipProvider>,
  );
}

const ownButton = () => screen.getByRole("button", { name: /Billy the Marlin as (not )?owned/i });
const wantButton = () => screen.getByRole("button", { name: /(Add|Remove).*wanted/i });

beforeEach(() => {
  owned = {};
  wanted = {};
  setOwned.mockClear();
  setWanted.mockClear();
});

afterEach(cleanup);

describe("owned and wanted are mutually exclusive", () => {
  it("clears wanted when you mark something owned", () => {
    wanted = { [GIVEAWAY_ID]: true };
    renderCard();

    fireEvent.click(ownButton());

    expect(setOwned).toHaveBeenCalledWith(GIVEAWAY_ID, true);
    expect(setWanted).toHaveBeenCalledWith(GIVEAWAY_ID, false);
  });

  it("clears owned when you mark something wanted", () => {
    owned = { [GIVEAWAY_ID]: true };
    renderCard();

    fireEvent.click(wantButton());

    expect(setWanted).toHaveBeenCalledWith(GIVEAWAY_ID, true);
    expect(setOwned).toHaveBeenCalledWith(GIVEAWAY_ID, false);
  });

  it("leaves the other flag alone when you clear one", () => {
    owned = { [GIVEAWAY_ID]: true };
    renderCard();

    fireEvent.click(ownButton());

    expect(setOwned).toHaveBeenCalledWith(GIVEAWAY_ID, false);
    expect(setWanted).not.toHaveBeenCalled();
  });

  it("doesn't touch ownership when you star something you don't own", () => {
    renderCard();

    fireEvent.click(wantButton());

    expect(setWanted).toHaveBeenCalledWith(GIVEAWAY_ID, true);
    expect(setOwned).not.toHaveBeenCalled();
  });
});
