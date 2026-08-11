import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  approveTagRequest,
  rejectTagRequest,
  submitTagRequest,
  type TagRequest,
} from "@/lib/tagRequests";

// The request/ruling flow behind the admin-curated vocabulary. Stubs the
// client rather than the database, so what's covered is the part that's ours:
// validation before anything is written, the order an approval does its steps
// in (mint, apply, then settle — settling first would mark a request approved
// that changed nothing), and the guard against a ruling RLS filtered to
// nothing.

type Call = { table: string; op: string; payload?: unknown; options?: unknown };

function stubClient(responses: {
  insert?: { error: { message: string; code?: string } | null };
  upsert?: Record<string, { error: { message: string } | null }>;
  update?: { data: unknown[] | null; error: { message: string } | null };
} = {}) {
  const calls: Call[] = [];

  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      let result: unknown = { data: [], error: null };

      const step = (name: string) => (...args: unknown[]) => {
        if (name === "insert") {
          calls.push({ table, op: "insert", payload: args[0] });
          result = { data: null, error: responses.insert?.error ?? null };
        }
        if (name === "upsert") {
          calls.push({ table, op: "upsert", payload: args[0], options: args[1] });
          result = { data: null, error: responses.upsert?.[table]?.error ?? null };
        }
        if (name === "update") {
          calls.push({ table, op: "update", payload: args[0] });
          result = responses.update ?? { data: [{ id: "req-1" }], error: null };
        }
        return chain;
      };

      for (const name of ["insert", "upsert", "update", "select", "eq"]) {
        chain[name] = step(name);
      }
      chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);

      return chain;
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

const request: TagRequest = {
  id: "req-1",
  label: "Star Wars",
  slug: "star-wars",
  bobblehead_id: "grogu-2023",
  team_slug: "dodgers",
  source: "curated",
  requested_by: "rep-1",
  created_at: "2026-08-08T00:00:00Z",
};

describe("submitTagRequest", () => {
  it("files a validated, normalized request", async () => {
    const { client, calls } = stubClient();

    const result = await submitTagRequest(client, {
      label: "  Star   Wars ",
      bobbleheadId: "grogu-2023",
      teamSlug: "dodgers",
      source: "curated",
      requestedBy: "rep-1",
    });

    expect(result).toEqual({ error: null, slug: "star-wars", label: "Star Wars" });
    expect(calls).toEqual([
      {
        table: "tag_requests",
        op: "insert",
        payload: {
          label: "Star Wars",
          slug: "star-wars",
          bobblehead_id: "grogu-2023",
          team_slug: "dodgers",
          source: "curated",
          requested_by: "rep-1",
        },
      },
    ]);
  });

  it("refuses a label the vocabulary wouldn't accept, before writing anything", async () => {
    const { client, calls } = stubClient();

    const result = await submitTagRequest(client, {
      label: "•••",
      bobbleheadId: "grogu-2023",
      teamSlug: "dodgers",
      source: "curated",
      requestedBy: "rep-1",
    });

    expect(result.error).toMatch(/letters or numbers/);
    expect(calls).toHaveLength(0);
  });

  // The trigger's message is already user-ready, but the raw SQL text is not
  // what the other public write paths show, so this goes through the same
  // rewrite they use.
  it("turns a rate-limit rejection into friendly copy", async () => {
    const { client } = stubClient({
      insert: { error: { message: "You're requesting tags too quickly...", code: "BB429" } },
    });

    const result = await submitTagRequest(client, {
      label: "Star Wars",
      bobbleheadId: "grogu-2023",
      teamSlug: "dodgers",
      source: "curated",
      requestedBy: "user-1",
    });

    expect(result.error).toBe(
      "You're doing that too often. Please wait a little while and try again.",
    );
  });

  // The partial unique index turns a double-ask into a 23505; from the
  // requester's side the tag is in the queue either way.
  it("treats asking twice as success", async () => {
    const { client } = stubClient({
      insert: { error: { message: "duplicate key value", code: "23505" } },
    });

    const result = await submitTagRequest(client, {
      label: "Star Wars",
      bobbleheadId: "grogu-2023",
      teamSlug: "dodgers",
      source: "curated",
      requestedBy: "rep-1",
    });

    expect(result.error).toBeNull();
    expect(result.alreadyRequested).toBe(true);
  });
});

describe("approveTagRequest", () => {
  it("mints, applies, then settles — in that order", async () => {
    const { client, calls } = stubClient();

    expect(await approveTagRequest(client, request, "admin-1")).toEqual({ error: null });
    expect(calls.map((call) => `${call.table}.${call.op}`)).toEqual([
      "tags.upsert",
      "bobblehead_tags.upsert",
      "tag_requests.update",
    ]);
    expect(calls[0].payload).toEqual({
      slug: "star-wars",
      label: "Star Wars",
      created_by: "admin-1",
    });
    expect(calls[1].payload).toEqual({
      bobblehead_id: "grogu-2023",
      team_slug: "dodgers",
      tag_slug: "star-wars",
      created_by: "admin-1",
    });
    expect(calls[2].payload).toMatchObject({ status: "approved" });
  });

  // Naming a conflict target that isn't a key is a Postgres error, not a
  // no-op, so it fails the whole approval. bobblehead_tags' key covers
  // team_slug (60272ea); tags is keyed by slug alone.
  it("names conflict targets that match the actual keys", async () => {
    const { client, calls } = stubClient();

    await approveTagRequest(client, request, "admin-1");
    expect(calls[0].options).toMatchObject({ onConflict: "slug" });
    expect(calls[1].options).toMatchObject({
      onConflict: "bobblehead_id,team_slug,tag_slug",
    });
  });

  it("stops before applying when the mint fails", async () => {
    const { client, calls } = stubClient({ upsert: { tags: { error: { message: "nope" } } } });

    expect(await approveTagRequest(client, request, "admin-1")).toEqual({ error: "nope" });
    expect(calls.map((call) => `${call.table}.${call.op}`)).toEqual(["tags.upsert"]);
  });

  // RLS filters a forbidden update to zero rows and calls it a success, which
  // without this check would drop the request from the queue as if ruled on.
  it("treats a settle that touched no rows as a failure", async () => {
    const { client } = stubClient({ update: { data: [], error: null } });

    expect((await approveTagRequest(client, request, "admin-1")).error).toMatch(
      /admin access may have expired/,
    );
  });
});

describe("rejectTagRequest", () => {
  it("settles the request without touching the tag tables", async () => {
    const { client, calls } = stubClient();

    expect(await rejectTagRequest(client, "req-1")).toEqual({ error: null });
    expect(calls.map((call) => `${call.table}.${call.op}`)).toEqual(["tag_requests.update"]);
    expect(calls[0].payload).toMatchObject({ status: "rejected" });
  });
});
