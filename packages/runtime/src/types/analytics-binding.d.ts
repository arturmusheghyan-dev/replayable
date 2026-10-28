declare module '#analytics' {
  import type { AnalyticsController, CreateAnalyticsOptions } from './analytics.js';

  export function createAnalytics(options: CreateAnalyticsOptions): AnalyticsController;
}

declare module '#analytics-transport' {
  import type { AnalyticsTransport, RuntimeAnalyticsDestination } from './analytics.js';

  export function createAnalyticsTransport(
    destination: RuntimeAnalyticsDestination,
  ): AnalyticsTransport;
}
