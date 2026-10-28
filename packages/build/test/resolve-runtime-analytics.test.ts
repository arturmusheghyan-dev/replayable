import type { PlayableVariant } from '@replayablejs/config';
import { expect, it } from 'vitest';

import { resolveRuntimeAnalytics } from '../src/runtime/resolve-runtime-analytics.js';

it('selects no analytics or transport when both outputs are disabled', () => {
  const bindings = resolveRuntimeAnalytics(false);
  expect(bindings.analytics).toMatch(/analytics[/\\]disabled\.js$/);
  expect(bindings.transport).toMatch(/transports[/\\]disabled\.js$/);
});

it('keeps analytics but excludes the network transport in log-only builds', () => {
  const analytics: PlayableVariant['analytics'] = {
    buildId: 'TEST',
    logging: true,
    destination: false,
    events: {},
  };
  const bindings = resolveRuntimeAnalytics(analytics);
  expect(bindings.analytics).toMatch(/analytics[/\\]enabled\.js$/);
  expect(bindings.transport).toMatch(/transports[/\\]disabled\.js$/);
});

it.each([false, true])('selects the PostHog transport independently of logging=%s', (logging) => {
  const analytics: PlayableVariant['analytics'] = {
    buildId: 'TEST',
    logging,
    destination: {
      type: 'posthog',
      endpoint: 'https://example.invalid/events',
      projectToken: 'phc_test',
    },
    events: {},
  };
  const bindings = resolveRuntimeAnalytics(analytics);
  expect(bindings.analytics).toMatch(/analytics[/\\]enabled\.js$/);
  expect(bindings.transport).toMatch(/transports[/\\]posthog\.js$/);
});
