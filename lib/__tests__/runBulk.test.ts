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
    const resolvers: Array<() => void> = [];

    const action = () =>
      new Promise<void>((resolve) => {
        active += 1;
        peak = Math.max(peak, active);
        resolvers.push(() => {
          active -= 1;
          resolve();
        });
      });

    const promise = runBulk([1, 2, 3, 4, 5], action, { concurrency: 2 });

    // Drain the queued actions a tick at a time so the peak can be observed.
    while (resolvers.length < 5) {
      await Promise.resolve();
      resolvers.shift()?.();
    }
    resolvers.forEach((resolve) => resolve());
    await promise;

    expect(peak).toBeLessThanOrEqual(2);
  });

  it("does nothing for an empty list", async () => {
    const action = vi.fn();
    const { succeeded, failed } = await runBulk([], action);

    expect(action).not.toHaveBeenCalled();
    expect(succeeded).toEqual([]);
    expect(failed).toEqual([]);
  });
});
