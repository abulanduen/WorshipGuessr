export type PoolControls = {
  isPaused: () => boolean;
  isCancelled: () => boolean;
};

/**
 * Runs `worker` over `items` with a fixed number of concurrent lanes. Each
 * lane keeps pulling the next queued item until the queue is empty, is
 * cancelled, or is paused (in which case the lane idles without pulling new
 * work until resumed).
 */
export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, itemIndex: number, laneIndex: number) => Promise<void>,
  controls: PoolControls
): Promise<void> {
  let cursor = 0;
  const laneCount = Math.max(1, Math.min(concurrency, items.length));

  async function lane(laneIndex: number) {
    for (;;) {
      if (controls.isCancelled()) return;
      while (controls.isPaused() && !controls.isCancelled()) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      if (controls.isCancelled()) return;

      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index], index, laneIndex);
    }
  }

  await Promise.all(Array.from({ length: laneCount }, (_, i) => lane(i)));
}
