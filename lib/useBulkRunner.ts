import { useState } from "react";
import { runBulk, type BulkOutcome } from "@/lib/runBulk";

/**
 * Drives a bulk action over selected rows for the admin review queues: tracks a
 * busy flag and live progress while `runBulk` processes the items, and hands
 * back the per-item outcome so the page can drop the rows that succeeded and
 * surface any failures.
 */
export function useBulkRunner<T>() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const run = async (
    items: T[],
    action: (item: T) => Promise<void>,
  ): Promise<BulkOutcome<T>> => {
    setBusy(true);
    setProgress({ done: 0, total: items.length });
    try {
      return await runBulk(items, action, {
        concurrency: 4,
        onProgress: (done, total) => setProgress({ done, total }),
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return { busy, progress, run };
}
