import type {
  AnalyticsTransport,
  NormalizedAnalyticsEvent,
  RuntimeAnalyticsDestination,
} from '#types/analytics.js';

export function createAnalyticsTransport(
  destination: RuntimeAnalyticsDestination,
): AnalyticsTransport {
  return {
    send(event, options) {
      const body = JSON.stringify(createPostHogPayload(destination.projectToken, event));

      try {
        if (options.terminal && navigator.sendBeacon?.(destination.endpoint, body)) {
          return;
        }

        void fetch(destination.endpoint, {
          body,
          credentials: 'omit',
          keepalive: true,
          method: 'POST',
          mode: 'no-cors',
          referrerPolicy: 'no-referrer',
        }).catch(() => {});
      } catch {
        // Analytics must never interrupt gameplay.
      }
    },
  };
}

function createPostHogPayload(projectToken: string, event: NormalizedAnalyticsEvent) {
  return {
    api_key: projectToken,
    distinct_id: event.sessionId,
    event: event.eventName,
    properties: {
      $process_person_profile: false,
      build_id: event.buildId,
      elapsed_ms: event.elapsedMs,
      height: event.height,
      ...(event.integerValue === undefined ? {} : { integer_value: event.integerValue }),
      language: event.language,
      network: event.network,
      orientation: event.orientation,
      schema_version: event.schemaVersion,
      sequence: event.sequence,
      since_previous_ms: event.sincePreviousMs,
      version: event.version,
      width: event.width,
    },
    timestamp: event.timestamp,
  };
}
