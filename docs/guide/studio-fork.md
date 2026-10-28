# Studio fork releases and analytics

The maintained Studio engine is `arturmusheghyan-dev/replayable`, branch `main`. It includes the Studio parameter definitions and metadata from `feat/studio-params` together with analytics from `analytics-posthog` and Helix, TikTok and Snapchat delivery support. The old feature branches remain references. Do not merge them wholesale over newer parameter support.

## Distribution

Studio consumers install exact GitHub Release archive URLs, not Git branches or upstream npm packages. The combined release is `studio-preview.4`, package version `0.1.0-studio-preview.4`. It adds independent console logging and sending controls to the parameters and analytics available in preview 2. Source manifests retain the upstream source version; only staged archive manifests receive the fork version and fixed internal archive URLs. All eleven public packages use one fork version, including Pixi. Archives are private for npm publication, but installable through their GitHub URLs.

Run frozen installation and `pnpm check`, the three example exports, and `pnpm packages:check` first. Commit/push the reviewed source to this fork's main and require CI's three platform checks to pass. From that clean, built commit run:

```sh
pnpm fork:pack /absolute/path/to/a-new-release-directory
```

The command refuses dirty source, another branch, an existing destination, or an already published tag. It packages all public modules, resolves internal dependencies, preserves licenses, and writes `preview-manifest.json`, `SHA256SUMS`, and the packaging sources. It never commits or publishes. Publish a complete release from that exact main commit only after inspecting the archives. Upload all assets to a draft release first, verify completeness/checksums, then publish it. Never replace an existing tag or asset. The inherited npm release and Pages deployment jobs are restricted to the upstream repository.

Install the published URLs in a clean consumer before changing playable dependency pins. Consumers must retain all matching internal fork packages; do not mix upstream and fork runtimes. Commit both package manifest and lockfile. Local-engine connections are temporary and must be restored before adopting the published release. Keep `studio-preview.2` and `studio-params-preview.1` intact for rollback; reverting the consumer dependency commit restores its previous pins. Existing Studio-managed workspaces update through their normal reviewed source update flow.

## Configuration and events

Analytics defaults to `false`. Configure destinations, explicit network routes, and declared custom events under the root `analytics` configuration. A missing route or `false` route excludes the active transport for that network. It also compiles analytics out unless console logging is explicitly enabled for that network. PostHog requires an HTTPS endpoint and its public project ingestion token; never embed personal/admin API keys. Enabling a route does not certify ad-network acceptance of outbound analytics.

```ts
analytics: {
  buildId: 'my-playable@0.0.0',
  destinations: {
    pilot: { type: 'posthog', endpoint: 'https://us.i.posthog.com/i/v0/e/', projectToken: 'phc_REPLACE' },
  },
  routes: { preview: 'pilot' },
  events: { tutorial_completed: {}, zones_created: { integer: { min: 0, max: 1000 } } },
}
```

Use `playable.analytics.track('tutorial_completed')` or `playable.analytics.track('zones_created', count)`. Undeclared events, invalid names, and out-of-bounds/noninteger payloads are rejected. The `replayable_` prefix is reserved.

The original automatic events are `replayable_started`, `replayable_first_frame`, `replayable_first_interaction`, `replayable_completed`, and `replayable_cta`. Completion integer values remain success 0, failure 1, skip 2, duration timeout 3, inactivity timeout 4. Events carry session ID, ordered sequence, build ID, creative version, network, language, viewport, orientation, and wall-clock elapsed timing. The first visible ready state starts collection; early first interaction is retained. Limits are 32 events per name and 256 per session. Transport failure does not stop gameplay and no delivery success is promised by the no-CORS transport.

## Validation

Engine tests use mocked/intercepted delivery, never the live analytics project. Verify both enabled and disabled exports and packed consumers alongside structured parameter regressions. Focused manual preview inspection verifies real gameplay call sites; technical checks alone do not prove gameplay or ad-network behavior. Do not restore the retired gameplay-QA suite.

## Console logging and sending

`studio-preview.4` adds independent `logging` and `sending` controls; the older `studio-preview.2` packages do not accept them. Upgrade every Replayable module together before adding the settings to a pinned consumer. This change does not add Studio controls or a live runtime switch.

Both controls accept a boolean for every network or a map of network-specific booleans. Logging defaults to `false`; sending defaults to `true`. Unspecified map entries use those same defaults. Sending still requires an explicit configured route. `analytics: false` disables both outputs.

For local inspection without sending Preview events to PostHog, add these fields to the existing analytics object:

```ts
logging: { preview: true },
sending: { preview: false },
```

Other routed networks retain their existing sending behavior with logging off. This applies to the `preview` network, including exported Preview HTML, not just the development server. Use `logging: false` for completely silent delivery output. To test delivery and logging together on Preview, change its sending value to `true`. Use `sending: false` to stop sending on every network without deleting destinations or routes.

Console output is one line per accepted event, containing only its name and optional integer value:

```text
[Analytics] tutorial_completed
[Analytics] first_zone_created
[Analytics] zones_created: 0
```

The same logger covers automatic engine events and custom events. It logs after readiness, declaration/value validation and existing event limits. Invalid, premature and capped custom events are ignored as before. A console line is not a delivery receipt. It contains no destination token, session metadata or payload dump. Console failures cannot interrupt gameplay or stop enabled delivery.

Log-only variants omit destination credentials and select the disabled transport module. Fully disabled variants keep the existing no-op implementation. Configuration changes take effect after restarting the dev preview or rebuilding the output; existing exported files do not change. No event names, counters or gameplay triggers are added or modified.

## Combined network release

`studio-preview.4` combines the analytics logging/sending controls with network support. Helix (`adn`) and TikTok retain their own runtime/analytics identities while reusing the AppLovin and Mintegral integrations. Snapchat requires portrait output and forbids an outbound analytics destination; disabled analytics and logging-only configurations are supported. No new analytics route is enabled automatically. See [export documentation](../reference/export.md) for packaging and manual host checks. Keep `studio-preview.3` available for rollback; consumers must revert new network configuration and package pins together.
