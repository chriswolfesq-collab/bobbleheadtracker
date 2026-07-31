import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { deleteTag, mergeTags, renameTag } from "@/lib/adminTags";

// The vocabulary edits an admin can make. Stubs the client rather than the
// database, so what's covered is the part that's ours: the guard against a
// write RLS filtered to nothing, and the order a merge does its two steps in —
// listings move first, the old tag goes second, because the other order drops
// labels on the floor if the second step fails.

type Call = { table: string; op: string; payload?: unknown };

/**
 * Enough of the query builder for these three functions. Each `from(...)` chain
 * records what it did and resolves to whatever the scenario says that table's
 * write returns; a builder is thenable, so `await`ing the chain is what
 * resolves it — the same shape supabase-js has.
 */
function stubClient(responses: {
  update?: { data: unknown[] | null; error: { message: string } | null };
  delete?: { data: unknown[] | null; error: { message: string } | null };
  select?: { data: unknown[] | null; error: { message: string } | null };
  upsert?: { error: { message: string } | null };
}) {
  const calls: Call[] = [];

  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      let result: unknown = { data: [], error: null };

      const step = (name: string) => (...args: unknown[]) => {
        if (name === "update" || name === "delete" || name === "upsert") {
          calls.push({ table, op: name, payload: args[0] });
          result =
            name === "upsert"
              ? { data: null, error: responses.upsert?.error ?? null }
              : (responses[name] ?? { data: [{ slug: "x" }], error: null });
        }
        if (name === "select" && table === "bobblehead_tags") {
          calls.push({ table, op: "select" });
          result = responses.select ?? { data: [], error: null };
        }
        return chain;
      };

      for (const name of ["select", "update", "delete", "upsert", "eq", "order", "range"]) {
        chain[name] = step(name);
      }
      chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);

      return chain;
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

const assignment = (bobblehead_id: string, team_slug: string) => ({ bobblehead_id, team_slug });

describe("renameTag", () => {
  it("saves a validated label", async () => {
    const { client, calls } = stubClient({});

    expect(await renameTag(client, "star-wars", "  Star   Wars ")).toEqual({ error: null });
    expect(calls).toContainEqual({ table: "tags", op: "update", payload: { label: "Star Wars" } });
  });

  it("refuses a label the vocabulary wouldn't accept", async () => {
    const { client, calls } = stubClient({});

    expect((await renameTag(client, "star-wars", "•••")).error).toMatch(/letters or numbers/);
    expect(calls).toHaveLength(0);
  });

  // RLS filters a forbidden write to zero rows and calls it a success, which
  // without this check would close the form as though the rename took.
  it("treats a write that touched no rows as a failure", async () => {
    const { client } = stubClient({ update: { data: [], error: null } });

    expect((await renameTag(client, "star-wars", "Star Wars")).error).toMatch(
      /admin access may have expired/,
    );
  });
});

describe("deleteTag", () => {
  it("reports the database's own error", async () => {
    const { client } = stubClient({ delete: { data: null, error: { message: "nope" } } });

    expect(await deleteTag(client, "star-wars")).toEqual({ error: "nope" });
  });

  it("treats a delete that touched no rows as a failure", async () => {
    const { client } = stubClient({ delete: { data: [], error: null } });

    expect((await deleteTag(client, "star-wars")).error).toMatch(/admin access may have expired/);
  });
});

describe("mergeTags", () => {
  it("moves every listing onto the other tag, then retires this one", async () => {
    const { client, calls } = stubClient({
      select: { data: [assignment("grogu-2023", "dodgers"), assignment("vader-2019", "nats")], error: null },
    });

    const result = await mergeTags(client, {
      fromSlug: "star-war",
      intoSlug: "star-wars",
      createdBy: "admin-1",
    });

    expect(result).toEqual({ error: null, moved: 2 });
    expect(calls.map((call) => `${call.table}.${call.op}`)).toEqual([
      "bobblehead_tags.select",
      "bobblehead_tags.upsert",
      "tags.delete",
    ]);
    expect(calls[1].payload).toEqual([
      { bobblehead_id: "grogu-2023", team_slug: "dodgers", tag_slug: "star-wars", created_by: "admin-1" },
      { bobblehead_id: "vader-2019", team_slug: "nats", tag_slug: "star-wars", created_by: "admin-1" },
    ]);
  });

  // The listings are the thing worth protecting: if the move fails, the tag
  // they're under has to still be there.
  it("leaves the tag standing if the move fails", async () => {
    const { client, calls } = stubClient({
      select: { data: [assignment("grogu-2023", "dodgers")], error: null },
      upsert: { error: { message: "denied" } },
    });

    const result = await mergeTags(client, {
      fromSlug: "star-war",
      intoSlug: "star-wars",
      createdBy: null,
    });

    expect(result.error).toMatch(/denied/);
    expect(result.moved).toBe(0);
    expect(calls.some((call) => call.op === "delete")).toBe(false);
  });

  it("still retires a tag nothing carries", async () => {
    const { client, calls } = stubClient({ select: { data: [], error: null } });

    expect(await mergeTags(client, { fromSlug: "unused", intoSlug: "star-wars", createdBy: null }))
      .toEqual({ error: null, moved: 0 });
    expect(calls.some((call) => call.op === "upsert")).toBe(false);
    expect(calls.some((call) => call.op === "delete")).toBe(true);
  });

  it("won't merge a tag into itself", async () => {
    const { client, calls } = stubClient({});

    expect((await mergeTags(client, { fromSlug: "a-tag", intoSlug: "a-tag", createdBy: null })).error)
      .toMatch(/different tag/);
    expect(calls).toHaveLength(0);
  });
});
