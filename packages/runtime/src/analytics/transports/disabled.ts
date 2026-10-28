import type { AnalyticsTransport, RuntimeAnalyticsDestination } from '#types/analytics.js';

const disabledTransport: AnalyticsTransport = { send() {} };

export function createAnalyticsTransport(
  _destination: RuntimeAnalyticsDestination,
): AnalyticsTransport {
  return disabledTransport;
}
