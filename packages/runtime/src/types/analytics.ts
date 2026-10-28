import type { PlayableCompletionReason } from './completion.js';
import type { RuntimeState } from './runtime.js';
import type { PostRenderContext, UpdateChannel } from './update.js';

/** Playable-owned analytics API. Custom events must be declared in project configuration. */
export interface PlayableAnalytics {
  track(eventName: string, integerValue?: number): void;
}

export interface RuntimeAnalyticsEventDefinition {
  readonly description?: string | undefined;
  readonly integer?: { readonly min: number; readonly max: number } | undefined;
}

export interface RuntimePostHogAnalyticsDestination {
  readonly type: 'posthog';
  readonly endpoint: string;
  readonly projectToken: string;
}

export type RuntimeAnalyticsDestination = RuntimePostHogAnalyticsDestination;

export type RuntimeAnalyticsConfig =
  | false
  | {
      readonly buildId: string;
      readonly destination: RuntimeAnalyticsDestination;
      readonly events: Readonly<Record<string, RuntimeAnalyticsEventDefinition>>;
    };

export interface NormalizedAnalyticsEvent {
  readonly buildId: string;
  readonly elapsedMs: number;
  readonly eventName: string;
  readonly height: number;
  readonly integerValue?: number;
  readonly language: string;
  readonly network: string;
  readonly orientation: string;
  readonly schemaVersion: 1;
  readonly sequence: number;
  readonly sessionId: string;
  readonly sincePreviousMs: number;
  readonly timestamp: string;
  readonly version: string;
  readonly width: number;
}

export interface AnalyticsTransport {
  send(event: NormalizedAnalyticsEvent, options: { readonly terminal: boolean }): void;
}

export interface AnalyticsController extends PlayableAnalytics {
  recordCompletion(reason: PlayableCompletionReason): void;
  recordCta(): void;
  recordFirstInteraction(): void;
  start(): void;
}

export interface CreateAnalyticsOptions {
  readonly config: RuntimeAnalyticsConfig;
  readonly getState: () => RuntimeState;
  readonly postRender: UpdateChannel<PostRenderContext>;
  readonly runtime: {
    readonly language: string;
    readonly network: string;
    readonly version: string;
  };
}
