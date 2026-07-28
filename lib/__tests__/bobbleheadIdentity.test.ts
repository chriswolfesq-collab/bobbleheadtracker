import { describe, expect, it } from "vitest";
import { bobbleheadHref } from "@/lib/bobbleheadIdentity";

describe("bobbleheadHref", () => {
  it("links curated listings to their dedicated detail page", () => {
    expect(bobbleheadHref("dodgers", "shohei-ohtani-2024", true)).toBe(
      "/teams/dodgers/bobbleheads/shohei-ohtani-2024",
    );
  });

  it("links community-only listings through the community view with the id as a query param", () => {
    expect(bobbleheadHref("dodgers", "fan-submitted-99", false)).toBe(
      "/teams/dodgers/community/fan-submitted-99",
    );
  });

  it("url-encodes ids that contain query-unsafe characters", () => {
    expect(bobbleheadHref("mets", "a b&c", false)).toBe(
      "/teams/mets/community/a%20b%26c",
    );
  });
});
