import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { buildBobbleheadResolver } from "@/lib/bobbleheadIdentity";
import { getGiveawaysByTeamSlug } from "@/lib/bobbleheads";

// The resolver behind every cross-team list — tag pages, profile
// favorites/wanted/owned, admin browsers, public shelves. Stubbed at the client
// so the test runs against the real curated JSON without a Supabase connection.

const CURATED = getGiveawaysByTeamSlug("rockies")[0];

type Rows = Record<string, unknown[]>;

function stubClient(rows: Rows): SupabaseClient {
  return {
    from: (table: string) => ({
      select: () => ({ in: () => Promise.resolve({ data: rows[table] ?? [] }) }),
    }),
  } as unknown as SupabaseClient;
}

const resolverFor = (rows: Rows) => buildBobbleheadResolver(stubClient(rows), ["rockies"]);

describe("buildBobbleheadResolver", () => {
  it("names a curated listing from the catalog", async () => {
    const resolve = await resolverFor({});
    const identity = resolve("rockies", CURATED.id);

    expect(identity.title).toBe(CURATED.title);
    expect(identity.href).toBe(`/teams/rockies/bobbleheads/${CURATED.id}`);
    expect(identity.deleted).toBe(false);
  });

  // The catalog ships with the build, so a renamed listing keeps its old name
  // everywhere this resolver is used until the override is read too.
  it("prefers an admin's title over the one the catalog shipped", async () => {
    const resolve = await resolverFor({
      bobblehead_overrides: [
        { team_slug: "rockies", bobblehead_id: CURATED.id, title: "Renamed", deleted: false, photo_hidden: false },
      ],
    });

    expect(resolve("rockies", CURATED.id).title).toBe("Renamed");
  });

  it("reports a deleted listing, so the lists that link to it can drop it", async () => {
    const resolve = await resolverFor({
      bobblehead_overrides: [
        { team_slug: "rockies", bobblehead_id: CURATED.id, title: null, deleted: true, photo_hidden: false },
      ],
    });

    expect(resolve("rockies", CURATED.id).deleted).toBe(true);
  });

  it("takes the approved photo first, and drops a seed photo an admin hid", async () => {
    const withPhoto = await resolverFor({
      approved_photos: [
        { team_slug: "rockies", bobblehead_id: CURATED.id, image_url: "https://approved" },
      ],
    });
    const hidden = await resolverFor({
      bobblehead_overrides: [
        { team_slug: "rockies", bobblehead_id: CURATED.id, title: null, deleted: false, photo_hidden: true },
      ],
    });

    expect(withPhoto("rockies", CURATED.id).imageUrl).toBe("https://approved");
    expect(hidden("rockies", CURATED.id).imageUrl).toBeNull();
  });

  it("falls back to the community row for a listing the catalog has never had", async () => {
    const resolve = await resolverFor({
      community_bobbleheads: [
        { id: "community-1", team_slug: "rockies", title: "Todd Helton", image_url: "https://community" },
      ],
    });
    const identity = resolve("rockies", "community-1");

    expect(identity.title).toBe("Todd Helton");
    expect(identity.imageUrl).toBe("https://community");
    expect(identity.href).toBe("/teams/rockies/community/community-1");
  });
});
