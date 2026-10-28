import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PlayableVariant } from '@replayablejs/config';

const runtimeDirectory = dirname(fileURLToPath(import.meta.resolve('@replayablejs/runtime')));

/** Selects tree-shakeable analytics and destination modules for one concrete build. */
export function resolveRuntimeAnalytics(analytics: PlayableVariant['analytics']): {
  readonly analytics: string;
  readonly transport: string;
} {
  if (analytics === false) {
    return {
      analytics: resolve(runtimeDirectory, 'analytics/disabled.js'),
      transport: resolve(runtimeDirectory, 'analytics/transports/disabled.js'),
    };
  }

  return {
    analytics: resolve(runtimeDirectory, 'analytics/enabled.js'),
    transport: resolve(
      runtimeDirectory,
      `analytics/transports/${analytics.destination === false ? 'disabled' : analytics.destination.type}.js`,
    ),
  };
}
