import { describe, expect, it, vi } from "vitest";
import { runBulk } from "@/lib/runBulk";

describe("runBulk", () => {
  it("processes every item and reports each success", async () => {
    const items = [1, 2, 3, 4];
    const seen: number[] = [];

    const { succeeded, failed } = await runBulk(items, async (n) => {
      seen.push(n);
    });

    expect(succeeded.sort()).toEqual([1, 2, 3, 4]);
    expect(failed).toEqual([]);
    expect(seen.sort()).toEqual([1, 2, 3, 4]);
  });

  it("isolates failures instead of aborting the batch", async () => {
    const { succeeded, failed } = await runBulk([1, 2, 3], async (n) => {
      if (n === 2) throw new Error("boom");
    });

    expect(succeeded.sort()).toEqual([1, 3]);
    expect(failed).toEqual([{ item: 2, error: "boom" }]);
  });

  it("falls back to a generic message for non-Error throws", async () => {
    const { failed } = await runBulk([1], async () => {
      throw "nope";
    });

    expect(failed).toEqual([{ item: 1, error: "Failed" }]);
  });

  it("reports progress once per settled item, up to the total", async () => {
    const onProgress = vi.fn();

    await runBulk([1, 2, 3], async () => {}, { concurrency: 2, onProgress });

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
  });

  it("never runs more than `concurrency` actions at once", async () => {
    let active = 0;
    let peak = 0;

    // Each action parks on a timer, so every worker that is allowed to start
    // overlaps with the others and `peak` records the real high-water mark. An
    // unbounded runBulk would reach 5 here rather than the requested 2.
    const action = async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active -= 1;
    };

    await runBulk([1, 2, 3, 4, 5], action, { concurrency: 2 });

    expect(peak).toBe(2);
  });

  it("does nothing for an empty list", async () => {
    const action = vi.fn();
    const { succeeded, failed } = await runBulk([], action);

    expect(action).not.toHaveBeenCalled();
    expect(succeeded).toEqual([]);
    expect(failed).toEqual([]);
  });
});
