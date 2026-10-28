import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreateAnalyticsOptions, NormalizedAnalyticsEvent } from '../src/types/analytics.js';
import type { RuntimeState } from '../src/types/runtime.js';
import type { PostRenderContext } from '../src/types/update.js';

const transport = vi.hoisted(() => ({
  send: vi.fn<(event: NormalizedAnalyticsEvent, options: { readonly terminal: boolean }) => void>(),
}));

vi.mock('#analytics-transport', () => ({
  createAnalyticsTransport: () => transport,
}));

import { createAnalytics } from '../src/analytics/enabled.js';

describe('analytics', () => {
  beforeEach(() => {
    transport.send.mockReset();
  });

  it('records lifecycle and declared custom events with one session and ordered sequences', () => {
    let firstFrame: ((context: PostRenderContext) => void) | undefined;
    const analytics = createAnalytics({
      config: {
        buildId: 'TEST_BUILD',
        destination: {
          type: 'posthog',
          endpoint: 'https://us.i.posthog.com/i/v0/e/',
          projectToken: 'phc_test',
        },
        events: { target_tapped: { integer: { min: 1, max: 2 } } },
      },
      getState: createRuntimeState,
      postRender: {
        add(callback) {
          firstFrame = callback;
          return () => {
            firstFrame = undefined;
          };
        },
      },
      runtime: { language: 'en', network: 'preview', version: 'default' },
    });

    analytics.start();
    firstFrame?.({ timestamp: performance.now() });
    analytics.recordFirstInteraction();
    analytics.track('target_tapped', 2);
    analytics.recordCompletion('success');
    analytics.recordCta();

    const events = transport.send.mock.calls.map(([event]) => event);
    expect(events.map(({ eventName }) => eventName)).toEqual([
      'replayable_started',
      'replayable_first_frame',
      'replayable_first_interaction',
      'target_tapped',
      'replayable_completed',
      'replayable_cta',
    ]);
    expect(events.map(({ sequence }) => sequence)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(events.map(({ sessionId }) => sessionId))).toHaveLength(1);
    expect(events[3]).toMatchObject({ integerValue: 2, buildId: 'TEST_BUILD' });
    expect(events[4]).toMatchObject({ integerValue: 0 });
  });

  it('rejects undeclared or invalid custom events and caps each event name at 32', () => {
    const analytics = createAnalytics({
      config: {
        buildId: 'TEST_BUILD',
        destination: {
          type: 'posthog',
          endpoint: 'https://us.i.posthog.com/i/v0/e/',
          projectToken: 'phc_test',
        },
        events: { counted: { integer: { min: 0, max: 1 } } },
      },
      getState: createRuntimeState,
      postRender: { add: () => () => {} },
      runtime: { language: 'en', network: 'unity', version: 'default' },
    });
    analytics.start();
    analytics.track('missing', 1);
    analytics.track('counted', 2);
    for (let index = 0; index < 40; index += 1) {
      analytics.track('counted', 1);
    }

    expect(
      transport.send.mock.calls.filter(([event]) => event.eventName === 'counted'),
    ).toHaveLength(32);
  });
  it('waits for readiness, preserves early interaction, and starts only once', () => {
    const analytics = createAnalytics(testOptions());
    analytics.track('counted', 0);
    analytics.recordFirstInteraction();
    expect(transport.send).not.toHaveBeenCalled();
    analytics.start();
    analytics.start();
    analytics.track('counted', 0);
    expect(transport.send.mock.calls.map(([event]) => event.eventName)).toEqual([
      'replayable_started',
      'replayable_first_interaction',
      'counted',
    ]);
  });

  it('rejects invalid payloads and never interrupts gameplay on transport failure', () => {
    const analytics = createAnalytics(testOptions());
    analytics.start();
    analytics.track('counted');
    analytics.track('counted', 0.5);
    analytics.track('counted', -1);
    analytics.track('missing', 0);
    expect(transport.send).toHaveBeenCalledTimes(1);
    transport.send.mockImplementation(() => {
      throw new Error('offline');
    });
    expect(() => analytics.track('counted', 1)).not.toThrow();
    expect(() => analytics.recordCompletion('failure')).not.toThrow();
  });

  it('caps the complete session even across multiple declared events', () => {
    const options = testOptions();
    if (options.config === false) {
      throw new Error('test configuration');
    }
    const analytics = createAnalytics({
      ...options,
      config: {
        ...options.config,
        events: Object.fromEntries(
          Array.from({ length: 10 }, (_, index) => [`event_${index}`, {}]),
        ),
      },
    });
    analytics.start();
    for (let index = 0; index < 400; index += 1) {
      analytics.track(`event_${index % 10}`);
    }
    expect(transport.send).toHaveBeenCalledTimes(256);
  });
});

function testOptions(): CreateAnalyticsOptions {
  return {
    config: {
      buildId: 'TEST_BUILD',
      destination: {
        type: 'posthog',
        endpoint: 'https://example.invalid/events',
        projectToken: 'phc_test',
      },
      events: { counted: { integer: { min: 0, max: 10 } } },
    },
    getState: createRuntimeState,
    postRender: { add: () => () => {} },
    runtime: { language: 'en', network: 'preview', version: 'default' },
  };
}

function createRuntimeState(): RuntimeState {
  return {
    audio: { allowed: true, volume: 1 },
    completion: undefined,
    interacted: false,
    orientation: 'portrait',
    visible: true,
    viewport: { height: 800, width: 400 },
  };
}

it.each(['adn', 'tiktok'] as const)('retains %s identity in analytics events', (network) => {
  transport.send.mockClear();
  const options = testOptions();
  const analytics = createAnalytics({ ...options, runtime: { ...options.runtime, network } });
  analytics.start();
  analytics.recordCta();
  expect(transport.send.mock.calls.length).toBeGreaterThan(0);
  for (const [event] of transport.send.mock.calls) {
    expect(event.network).toBe(network);
  }
});
