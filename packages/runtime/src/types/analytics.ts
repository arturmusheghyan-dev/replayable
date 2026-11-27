import type { PlayableCompletionReason } from './completion.js';
import type { RuntimeState } from './runtime.js';
import type { PlayableCtaSource } from './store.js';
import type { PostRenderContext, UpdateChannel } from './update.js';

/** Playable-owned analytics API. Custom events must be declared in project configuration. */
export interface PlayableAnalytics {
  /** Replaces string context for one declared event; null clears it. Context is session-local. */
  setEventContext(eventName: string, properties: Readonly<Record<string, string>> | null): void;
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
      /** Package release, separate from the stable playable ID and creative version. */
      readonly releaseVersion?: string;
      readonly destination: RuntimeAnalyticsDestination | false;
      /** Console event names and optional values only; omitted means no logging. */
      readonly logging?: boolean;
      readonly events: Readonly<Record<string, RuntimeAnalyticsEventDefinition>>;
    };

export interface NormalizedAnalyticsEvent {
  readonly context?: Readonly<Record<string, string>>;
  readonly audioMuted: boolean;
  readonly avgFps?: number;
  readonly ctaSource?: PlayableCtaSource;
  readonly buildId: string;
  readonly releaseVersion?: string;
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
  recordCta(source?: PlayableCtaSource): void;
  recordFirstInteraction(): void;
  start(): void;
}

export interface CreateAnalyticsOptions {
  /** Internal delivery gate resolved by host initialization; logging stays enabled. */
  readonly canSend?: () => boolean;
  readonly config: RuntimeAnalyticsConfig;
  readonly getState: () => RuntimeState;
  readonly getAudioMuted: () => boolean;
  readonly frameObservations: UpdateChannel<number | undefined>;
  readonly postRender: UpdateChannel<PostRenderContext>;
  readonly runtime: {
    readonly language: string;
    readonly network: string;
    readonly version: string;
  };
}
