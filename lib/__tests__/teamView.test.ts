import { describe, expect, it } from "vitest";
import { mergeTeamViewQuery, teamHrefFromView, teamViewQuery, withTeamView } from "@/lib/teamView";

// Someone on page 4 of the Yankees who opens a bobblehead and then clicks the
// team crumb should land back on page 4 — with the tab and filters they had.
// The trail that makes that work rides along in `?from=`, so it has to survive
// a round trip and has to stay harmless when a stranger edits it.

describe("teamViewQuery", () => {
  it("keeps the team page's view keys", () => {
    expect(teamViewQuery("tab=owned&page=4")).toBe("tab=owned&page=4");
    expect(teamViewQuery("sort=title-asc&year=2019&photo=1&favorites=1&city=Oakland")).toBe(
      "sort=title-asc&year=2019&city=Oakland&photo=1&favorites=1",
    );
  });

  it("drops everything else, so `from` can never carry a redirect", () => {
    expect(teamViewQuery("page=2&next=https://evil.example.com")).toBe("page=2");
    expect(teamViewQuery("id=some-listing")).toBe("");
    expect(teamViewQuery("")).toBe("");
  });
});

describe("withTeamView / teamHrefFromView", () => {
  it("round-trips a view from a card link to the team crumb", () => {
    const view = teamViewQuery("tab=owned&page=4");
    const cardHref = withTeamView("/teams/yankees/bobbleheads/judge-2019", view);

    expect(cardHref).toBe("/teams/yankees/bobbleheads/judge-2019?from=tab%3Downed%26page%3D4");

    const from = new URL(cardHref, "https://bobbleshelf.com").searchParams.get("from") ?? "";
    expect(teamHrefFromView("yankees", teamViewQuery(from))).toBe("/teams/yankees?tab=owned&page=4");
  });

  it("leaves links alone when there's no view to carry", () => {
    expect(withTeamView("/teams/yankees/bobbleheads/judge-2019", "")).toBe(
      "/teams/yankees/bobbleheads/judge-2019",
    );
    expect(teamHrefFromView("yankees", "")).toBe("/teams/yankees");
  });

  it("appends to a link that already has a query", () => {
    expect(withTeamView("/teams/yankees/community?id=abc", "page=2")).toBe(
      "/teams/yankees/community?id=abc&from=page%3D2",
    );
  });
});

describe("mergeTeamViewQuery", () => {
  it("replaces the old view and keeps foreign params", () => {
    expect(mergeTeamViewQuery("page=2&tab=owned&ref=newsletter", "page=5")).toBe(
      "ref=newsletter&page=5",
    );
  });

  it("clears the view entirely once it's back to defaults", () => {
    expect(mergeTeamViewQuery("page=2&tab=owned", "")).toBe("");
  });
});
