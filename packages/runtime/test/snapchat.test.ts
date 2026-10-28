import { afterEach, expect, it, vi } from 'vitest';

import { createAdapter } from '../src/adapters/snapchat/index.js';
import type { HostUpdateListener } from '../src/types/host-adapter.js';

function browser() {
  const document = Object.assign(new EventTarget(), {
    readyState: 'complete',
    visibilityState: 'visible',
  });
  const window = Object.assign(new EventTarget(), { innerWidth: 400, innerHeight: 800 });
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  return { document, window };
}

afterEach(() => vi.unstubAllGlobals());

it('starts with browser visibility and forwards resize and background changes', async () => {
  const { document, window } = browser();
  const listener = vi.fn<HostUpdateListener>();
  const snapshot = await createAdapter().initialize(listener);
  expect(snapshot).toEqual({ visible: true, volume: 1, viewport: { width: 400, height: 800 } });
  document.visibilityState = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
  expect(listener).toHaveBeenLastCalledWith({ type: 'visibilitychange', visible: false });
  window.innerHeight = 700;
  window.dispatchEvent(new Event('resize'));
  expect(listener).toHaveBeenLastCalledWith({
    type: 'resize',
    viewport: { width: 400, height: 700 },
  });
});

it('waits for document readiness and invokes the host CTA only on a store action', async () => {
  const { document } = browser();
  document.readyState = 'loading';
  const onCTAClick = vi.fn<() => void>();
  vi.stubGlobal('ScPlayableAd', { onCTAClick });
  const adapter = createAdapter();
  let ready = false;
  const initialization = adapter.initialize(vi.fn<HostUpdateListener>()).then(() => {
    ready = true;
    return undefined;
  });
  await Promise.resolve();
  expect(ready).toBe(false);
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await initialization;
  expect(onCTAClick).not.toHaveBeenCalled();
  adapter.openStore('https://example.com/ignored-campaign-url');
  expect(onCTAClick).toHaveBeenCalledExactlyOnceWith();
});

it.each([undefined, null, {}, { onCTAClick: 'invalid' }])(
  'reports an unavailable Snapchat CTA API %j',
  (api) => {
    browser();
    vi.stubGlobal('ScPlayableAd', api);
    expect(() => createAdapter().openStore('https://example.com')).toThrow(
      'Snapchat requires window.ScPlayableAd.onCTAClick',
    );
  },
);
