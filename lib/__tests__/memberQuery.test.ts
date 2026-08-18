import { describe, expect, it } from "vitest";
import { MIN_MEMBER_QUERY, memberQuery, slugFromInput } from "@/lib/friends";

// The client's copy of the floor in supabase/member_search.sql. The two have to
// agree: if the input thinks a query is searchable when the RPC doesn't, the UI
// shows "Searching…" forever against a call that returned nothing.

describe("slugFromInput", () => {
  it("keeps a plain name as typed", () => {
    expect(slugFromInput("  Alex Ramirez ")).toBe("Alex Ramirez");
  });

  it("pulls the slug out of a full shelf link", () => {
    expect(slugFromInput("https://bobbleshelf.com/shelf/alex-ramirez")).toBe("alex-ramirez");
  });

  it("drops a trailing slash, query and hash", () => {
    expect(slugFromInput("bobbleshelf.com/shelf/alex-ramirez/")).toBe("alex-ramirez");
    expect(slugFromInput("bobbleshelf.com/shelf/alex-ramirez?utm=x")).toBe("alex-ramirez");
    expect(slugFromInput("bobbleshelf.com/shelf/alex-ramirez#items")).toBe("alex-ramirez");
  });
});

describe("memberQuery", () => {
  it("refuses anything under the floor, so no round trip is spent", () => {
    expect(memberQuery("")).toBe("");
    expect(memberQuery("   ")).toBe("");
    expect(memberQuery("a")).toBe("");
    expect("ab".length).toBe(MIN_MEMBER_QUERY);
    expect(memberQuery("ab")).toBe("ab");
  });

  it("searches a pasted link by its slug", () => {
    expect(memberQuery("https://bobbleshelf.com/shelf/alex-ramirez")).toBe("alex-ramirez");
  });

  // A wildcard has to reach the RPC as a literal to be escaped there. Silently
  // treating it as "empty" here would hide the case rather than handle it.
  it("passes wildcard characters through as ordinary text", () => {
    expect(memberQuery("%%")).toBe("%%");
    expect(memberQuery("_a")).toBe("_a");
  });
});
