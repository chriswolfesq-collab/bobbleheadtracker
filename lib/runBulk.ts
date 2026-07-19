export type BulkFailure<T> = { item: T; error: string };

export type BulkOutcome<T> = {
  succeeded: T[];
  failed: BulkFailure<T>[];
};

type RunBulkOptions = {
  /** How many items to process at once. Defaults to 4. */
  concurrency?: number;
  /** Called after each item settles, so callers can render progress. */
  onProgress?: (done: number, total: number) => void;
};

/**
 * Run one async action over many items with a bounded concurrency, collecting
 * per-item successes and failures instead of failing the whole batch on the
 * first error. Used by the admin review queues for bulk approve/decline, where
 * each item may hit a different RPC or storage object and one bad row shouldn't
 * abort the rest.
 */
export async function runBulk<T>(
  items: T[],
  action: (item: T) => Promise<void>,
  options: RunBulkOptions = {},
): Promise<BulkOutcome<T>> {
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const total = items.length;
  const succeeded: T[] = [];
  const failed: BulkFailure<T>[] = [];
  let done = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        await action(item);
        succeeded.push(item);
      } catch (error) {
        failed.push({ item, error: error instanceof Error ? error.message : "Failed" });
      } finally {
        done += 1;
        options.onProgress?.(done, total);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));

  return { succeeded, failed };
}
