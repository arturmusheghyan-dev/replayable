import { afterEach, expect, it, vi } from 'vitest';

import { createFrameMetrics } from '../src/analytics/frame-metrics.js';
import { createUpdateChannel } from '../src/update/create-update-channel.js';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) {
    dispose();
  }
  vi.unstubAllGlobals();
});
function harness() {
  const frames = createUpdateChannel<number | undefined>(() => {});
  let visible = true;
  const metrics = createFrameMetrics(frames, () => visible);
  cleanup.push(() => metrics.dispose());
  return {
    frames,
    metrics,
    visible: (value: boolean) => {
      visible = value;
    },
  };
}
it('uses total interval time, includes foreground stalls and omits unavailable samples', () => {
  const { frames, metrics } = harness();
  expect(metrics.value).toBeUndefined();
  frames.dispatch(0);
  expect(metrics.value).toBeUndefined();
  frames.dispatch(10);
  expect(metrics.value).toBe(100);
  frames.dispatch(100);
  expect(metrics.value).toBe(20);
  frames.dispatch(110);
  expect(metrics.value).toBe(27.27);
  frames.dispatch(110);
  expect(metrics.value).toBe(27.27);
});
it('excludes host pauses and stopped scheduling without resetting accumulated samples', () => {
  const h = harness();
  h.frames.dispatch(0);
  h.frames.dispatch(20);
  h.visible(false);
  h.frames.dispatch(undefined);
  h.frames.dispatch(1000);
  h.visible(true);
  h.frames.dispatch(3000);
  h.frames.dispatch(3020);
  expect(h.metrics.value).toBe(50);
  h.frames.dispatch(undefined);
  h.frames.dispatch(6000);
  h.frames.dispatch(6040);
  expect(h.metrics.value).toBe(37.5);
});
it('handles document visibility overlapping host pauses and releases listeners', () => {
  const browser = new EventTarget();
  let visibilityState = 'visible';
  Object.defineProperty(browser, 'visibilityState', { get: () => visibilityState });
  vi.stubGlobal('document', browser);
  const h = harness();
  h.frames.dispatch(0);
  h.frames.dispatch(25);
  visibilityState = 'hidden';
  browser.dispatchEvent(new Event('visibilitychange'));
  h.frames.dispatch(50);
  h.visible(false);
  h.frames.dispatch(undefined);
  visibilityState = 'visible';
  browser.dispatchEvent(new Event('visibilitychange'));
  h.frames.dispatch(2000);
  h.visible(true);
  h.frames.dispatch(5000);
  h.frames.dispatch(5025);
  expect(h.metrics.value).toBe(40);
  h.metrics.dispose();
  expect(h.frames.hasListeners()).toBe(false);
  h.frames.dispatch(9000);
  expect(h.metrics.value).toBe(40);
});
