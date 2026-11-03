import type { UpdateChannel } from '#types/update.js';

/** Runtime frame cadence, not GPU time; sampling creates no rendering demand. */
export function createFrameMetrics(
  frames: UpdateChannel<number | undefined>,
  isVisible: () => boolean,
) {
  let previous: number | undefined;
  let intervals = 0;
  let elapsed = 0;
  const reset = (): void => {
    previous = undefined;
  };
  const browser = typeof document === 'undefined' ? undefined : document;
  browser?.addEventListener('visibilitychange', reset);
  const remove = frames.add((timestamp) => {
    if (
      timestamp === undefined ||
      !Number.isFinite(timestamp) ||
      !isVisible() ||
      (browser !== undefined && browser.visibilityState !== 'visible')
    ) {
      reset();
      return;
    }
    if (previous !== undefined && timestamp > previous) {
      elapsed += timestamp - previous;
      intervals += 1;
    }
    previous = timestamp;
  });
  return {
    get value(): number | undefined {
      return intervals === 0 ? undefined : Math.round((intervals * 100_000) / elapsed) / 100;
    },
    dispose(): void {
      remove();
      browser?.removeEventListener('visibilitychange', reset);
      reset();
    },
  };
}
