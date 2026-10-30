import { createAnalyticsTransport } from '#analytics-transport';
import type {
  AnalyticsController,
  CreateAnalyticsOptions,
  NormalizedAnalyticsEvent,
  RuntimeAnalyticsEventDefinition,
} from '#types/analytics.js';
import type { PlayableCompletionReason } from '#types/completion.js';

const maximumEventsPerName = 32;
const maximumEventsPerSession = 256;
const completionValues: Record<PlayableCompletionReason, number> = {
  'duration-timeout': 3,
  failure: 1,
  'inactivity-timeout': 4,
  skip: 2,
  success: 0,
};

export function createAnalytics(options: CreateAnalyticsOptions): AnalyticsController {
  if (options.config === false) {
    throw new Error('Enabled analytics requires configuration');
  }

  const config = options.config;
  const transport =
    config.destination === false ? undefined : createAnalyticsTransport(config.destination);
  const counts = new Map<string, number>();
  const sessionId = createSessionId();
  let eventCount = 0;
  let pendingFirstInteraction = false;
  let previousTime = 0;
  let sequence = 0;
  let started = false;
  let startedTime = 0;

  function send(eventName: string, integerValue?: number, terminal = false): void {
    if (!started || eventCount >= maximumEventsPerSession) {
      return;
    }

    const nameCount = counts.get(eventName) ?? 0;
    if (nameCount >= maximumEventsPerName) {
      return;
    }

    const now = performance.now();
    const state = options.getState();
    const event: NormalizedAnalyticsEvent = {
      buildId: config.buildId,
      ...(config.releaseVersion === undefined ? {} : { releaseVersion: config.releaseVersion }),
      elapsedMs: Math.max(0, Math.round(now - startedTime)),
      eventName,
      height: state.viewport.height,
      ...(integerValue === undefined ? {} : { integerValue }),
      language: options.runtime.language,
      network: options.runtime.network,
      orientation: state.orientation,
      schemaVersion: 1,
      sequence: ++sequence,
      sessionId,
      sincePreviousMs: Math.max(0, Math.round(now - previousTime)),
      timestamp: new Date().toISOString(),
      version: options.runtime.version,
      width: state.viewport.width,
    };

    previousTime = now;
    eventCount += 1;
    counts.set(eventName, nameCount + 1);

    if (config.logging) {
      try {
        console.log(
          `[Analytics] ${eventName}${integerValue === undefined ? '' : `: ${integerValue}`}`,
        );
      } catch {
        // A replaced console must not interrupt gameplay or analytics delivery.
      }
    }

    try {
      transport?.send(event, { terminal });
    } catch {
      // Analytics must never interrupt gameplay.
    }
  }

  return {
    recordCompletion(reason) {
      send('replayable_completed', completionValues[reason], true);
    },
    recordCta() {
      send('replayable_cta', undefined, true);
    },
    recordFirstInteraction() {
      if (!started) {
        pendingFirstInteraction = true;
        return;
      }
      send('replayable_first_interaction');
    },
    start() {
      if (started) {
        return;
      }
      started = true;
      startedTime = performance.now();
      previousTime = startedTime;
      send('replayable_started');

      let removeFirstFrame: (() => void) | undefined;
      removeFirstFrame = options.postRender.add(() => {
        removeFirstFrame?.();
        send('replayable_first_frame');
      });

      if (pendingFirstInteraction) {
        pendingFirstInteraction = false;
        send('replayable_first_interaction');
      }
    },
    track(eventName, integerValue) {
      const definition = config.events[eventName];
      if (!definition || !isValidIntegerValue(definition, integerValue)) {
        return;
      }
      send(eventName, integerValue);
    },
  };
}

function isValidIntegerValue(
  definition: RuntimeAnalyticsEventDefinition,
  integerValue: number | undefined,
): boolean {
  if (definition.integer === undefined) {
    return integerValue === undefined;
  }
  return (
    integerValue !== undefined &&
    Number.isInteger(integerValue) &&
    integerValue >= definition.integer.min &&
    integerValue <= definition.integer.max
  );
}

function createSessionId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}
