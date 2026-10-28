import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAnalytics as createDisabledAnalytics } from '../src/analytics/disabled.js';
import { createAnalyticsTransport } from '../src/analytics/transports/posthog.js';
import type { NormalizedAnalyticsEvent } from '../src/types/analytics.js';

const destination = {
  type: 'posthog' as const,
  endpoint: 'https://example.invalid/ingest',
  projectToken: 'phc_test',
};
const event: NormalizedAnalyticsEvent = {
  buildId: 'test@0.0.0',
  elapsedMs: 10,
  eventName: 'zones_created',
  height: 844,
  integerValue: 2,
  language: 'en',
  network: 'preview',
  orientation: 'portrait',
  schemaVersion: 1,
  sequence: 3,
  sessionId: 'test-session',
  sincePreviousMs: 4,
  timestamp: '2026-10-28T00:00:00.000Z',
  version: 'pl01_001',
  width: 390,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('analytics transport', () => {
  it('sends the original metadata without credentials or referrer', () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response());
    vi.stubGlobal('fetch', fetch);
    createAnalyticsTransport(destination).send(event, { terminal: false });
    expect(fetch).toHaveBeenCalledWith(
      destination.endpoint,
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        mode: 'no-cors',
        referrerPolicy: 'no-referrer',
        keepalive: true,
      }),
    );
    const body = fetch.mock.calls[0]![1]?.body;
    if (typeof body !== 'string') {
      throw new Error('Expected JSON body');
    }
    expect(JSON.parse(body)).toMatchObject({
      event: 'zones_created',
      distinct_id: 'test-session',
      properties: {
        build_id: 'test@0.0.0',
        integer_value: 2,
        version: 'pl01_001',
        network: 'preview',
        sequence: 3,
        $process_person_profile: false,
      },
    });
  });
  it('uses beacon for terminal events and falls back when it declines', () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response());
    const sendBeacon = vi.fn<typeof navigator.sendBeacon>().mockReturnValue(true);
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('navigator', { sendBeacon });
    const transport = createAnalyticsTransport(destination);
    transport.send(event, { terminal: true });
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    sendBeacon.mockReturnValue(false);
    transport.send(event, { terminal: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('contains synchronous and asynchronous network failures', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    const transport = createAnalyticsTransport(destination);
    expect(() => transport.send(event, { terminal: false })).not.toThrow();
    await Promise.resolve();
    fetch.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => transport.send(event, { terminal: false })).not.toThrow();
  });
  it('disabled analytics never touches the transport, console or runtime state', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetch = vi.fn<typeof globalThis.fetch>();
    const getState = vi.fn<() => never>(() => {
      throw new Error('Disabled analytics must not read state');
    });
    vi.stubGlobal('fetch', fetch);
    const analytics = createDisabledAnalytics({
      config: false,
      getState,
      postRender: { add: () => () => {} },
      runtime: { language: 'en', network: 'meta', version: 'default' },
    });
    analytics.start();
    analytics.track('zones_created', 2);
    analytics.recordFirstInteraction();
    analytics.recordCompletion('success');
    analytics.recordCta();
    expect(fetch).not.toHaveBeenCalled();
    expect(getState).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
