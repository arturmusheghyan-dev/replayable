import type { AnalyticsController, CreateAnalyticsOptions } from '#types/analytics.js';

const disabledAnalytics: AnalyticsController = {
  recordCompletion() {},
  recordCta() {},
  recordFirstInteraction() {},
  start() {},
  track() {},
};

export function createAnalytics(_options: CreateAnalyticsOptions): AnalyticsController {
  return disabledAnalytics;
}
