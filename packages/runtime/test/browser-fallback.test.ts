import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { createAdapter as applovin } from '../src/adapters/applovin/index.js';
import { createAdapter as google } from '../src/adapters/google/index.js';
import { createAdapter as liftoff } from '../src/adapters/liftoff/index.js';
import { createAdapter as meta } from '../src/adapters/meta/index.js';
import { createAdapter as mintegral } from '../src/adapters/mintegral/index.js';
import { createAdapter as moloco } from '../src/adapters/moloco/index.js';
import { createAdapter as snapchat } from '../src/adapters/snapchat/index.js';
import { createAdapter as unity } from '../src/adapters/unity/index.js';
import type { HostUpdateListener } from '../src/types/host-adapter.js';

const adapters = { applovin, google, liftoff, meta, mintegral, moloco, snapchat, unity };
const url = 'https://example.com/store';

function browser() {
  const document = Object.assign(new EventTarget(), {
    readyState: 'complete',
    visibilityState: 'visible',
  });
  const window = Object.assign(new EventTarget(), {
    innerWidth: 390,
    innerHeight: 844,
    open: vi.fn<() => void>(),
  });
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', window);
  return { document, window };
}
function mraid(version = '2.0') {
  const events = new Map<string, (...args: number[]) => void>();
  const api = {
    getState: () => 'default',
    getVersion: () => version,
    isViewable: () => false,
    getCurrentPosition: () => ({ width: 320, height: 480 }),
    open: vi.fn<() => void>(),
    addEventListener: vi.fn<(name: string, listener: (...args: number[]) => void) => void>(
      (name, listener) => events.set(name, listener),
    ),
    removeEventListener: vi.fn<() => void>(),
  };
  vi.stubGlobal('mraid', api);
  return { api, events };
}
beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => {}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(Object.entries(adapters))(
  '%s falls back without changing globals or double-subscribing',
  async (name, create) => {
    const { document, window } = browser();
    const before = Object.keys(window);
    const listener = vi.fn<HostUpdateListener>();
    const adapter = create();
    const initial = adapter.initialize(listener);
    expect(adapter.initialize(listener)).toBe(initial);
    expect(await initial).toEqual({
      browserFallback: true,
      visible: true,
      volume: 1,
      viewport: { width: 390, height: 844 },
    });
    expect(Object.keys(window)).toEqual(before);
    document.visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(listener).toHaveBeenCalledExactlyOnceWith({ type: 'visibilitychange', visible: false });
    window.innerWidth = 844;
    window.dispatchEvent(new Event('resize'));
    expect(listener).toHaveBeenLastCalledWith({
      type: 'resize',
      viewport: { width: 844, height: 844 },
    });
    adapter.notifyReady?.();
    adapter.notifyComplete?.();
    adapter.openStore(url);
    const expectedCalls =
      name === 'snapchat' || name === 'moloco' ? [] : [[url, '_blank', 'noopener,noreferrer']];
    expect(window.open.mock.calls).toEqual(expectedCalls);
  },
);

it.each([applovin, unity, liftoff])(
  'preserves loading and hidden MRAID state instead of starting a browser preview',
  async (create) => {
    browser();
    const { api, events } = mraid('3.0');
    api.getState = () => 'loading';
    const listener = vi.fn<HostUpdateListener>();
    const adapter = create();
    let settled = false;
    const ready = adapter.initialize(listener).then((value) => {
      settled = true;
      return value;
    });
    await vi.waitFor(() => expect(events.has('ready')).toBe(true));
    expect(settled).toBe(false);
    api.getState = () => 'default';
    events.get('ready')?.();
    expect(await ready).toEqual({
      visible: false,
      volume: 1,
      viewport: { width: 320, height: 480 },
    });
    events.get('exposureChange')?.(80);
    expect(listener).toHaveBeenLastCalledWith({ type: 'visibilitychange', visible: true });
    events.get('audioVolumeChange')?.(40);
    expect(listener).toHaveBeenLastCalledWith({ type: 'volumechange', volume: 0.4 });
    adapter.openStore(url);
    expect(api.open.mock.calls).toEqual(create === liftoff ? [[]] : [[url]]);
  },
);

it('detects a host installed during document bootstrap, and keeps its campaign CTA', async () => {
  const { document, window } = browser();
  document.readyState = 'loading';
  const adapter = liftoff();
  const initialization = adapter.initialize(vi.fn<() => void>());
  const { api } = mraid();
  const open = vi.fn<() => void>();
  Object.assign(window, { Liftoff: { ready: (callback: () => void) => callback(), open } });
  document.readyState = 'interactive';
  document.dispatchEvent(new Event('DOMContentLoaded'));
  expect(await initialization).not.toHaveProperty('browserFallback');
  adapter.openStore(url);
  expect(open).toHaveBeenCalledExactlyOnceWith();
  expect(api.open).not.toHaveBeenCalled();
});

it.each([null, {}, { getState: 'broken' }])(
  'does not hide a malformed MRAID host %j',
  async (sdk) => {
    const { window } = browser();
    vi.stubGlobal('mraid', sdk);
    await expect(unity().initialize(vi.fn<() => void>())).rejects.toThrow(/getState|properties/i);
    expect(window.open).not.toHaveBeenCalled();
  },
);

it('keeps Mintegral gameStart/gameClose and notifyReady/complete/install ownership', async () => {
  const { document, window } = browser();
  const gameReady = vi.fn<() => void>();
  const gameEnd = vi.fn<() => void>();
  const install = vi.fn<() => void>();
  const host = Object.assign(window, {
    gameReady,
    gameEnd,
    install,
    gameStart: () => {},
    gameClose: () => {},
  });
  const listener = vi.fn<HostUpdateListener>();
  const adapter = mintegral();
  expect(await adapter.initialize(listener)).toMatchObject({ visible: false });
  adapter.notifyReady?.();
  expect(gameReady).toHaveBeenCalledExactlyOnceWith();
  host.gameStart();
  expect(listener).toHaveBeenLastCalledWith({ type: 'visibilitychange', visible: true });
  document.visibilityState = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
  expect(listener).toHaveBeenLastCalledWith({ type: 'visibilitychange', visible: false });
  host.gameClose();
  document.visibilityState = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
  expect(listener).toHaveBeenLastCalledWith({ type: 'visibilitychange', visible: false });
  adapter.openStore(url);
  adapter.notifyComplete?.();
  expect(install).toHaveBeenCalledExactlyOnceWith();
  expect(gameEnd).toHaveBeenCalledExactlyOnceWith();
  expect(window.open).not.toHaveBeenCalled();
});

it.each([
  [meta, 'FbPlayableAd', 'onCTAClick'],
  [moloco, 'FbPlayableAd', 'onCTAClick'],
  [google, 'ExitApi', 'exit'],
  [snapchat, 'ScPlayableAd', 'onCTAClick'],
] as const)('keeps native campaign CTA when %s has %s', async (create, global, method) => {
  const { window } = browser();
  const call = vi.fn<() => void>();
  vi.stubGlobal(global, { [method]: call });
  const adapter = create();
  expect(await adapter.initialize(vi.fn<() => void>())).not.toHaveProperty('browserFallback');
  adapter.openStore(url);
  expect(call).toHaveBeenCalledExactlyOnceWith();
  expect(window.open).not.toHaveBeenCalled();
});

it.each([
  [meta, 'FbPlayableAd'],
  [moloco, 'FbPlayableAd'],
  [google, 'ExitApi'],
  [snapchat, 'ScPlayableAd'],
] as const)('does not redirect around a malformed %s host', async (create, global) => {
  const { window } = browser();
  vi.stubGlobal(global, {});
  const adapter = create();
  expect(await adapter.initialize(vi.fn<() => void>())).not.toHaveProperty('browserFallback');
  expect(() => adapter.openStore(url)).toThrow(/function|requires/);
  expect(window.open).not.toHaveBeenCalled();
});
