# Studio fork releases and analytics

The maintained Studio engine is `arturmusheghyan-dev/replayable`, branch `main`. It includes the Studio parameter definitions and metadata from `feat/studio-params` together with analytics from `analytics-posthog`. The old feature branches remain references. Do not merge them wholesale over newer parameter support.

## Distribution

Studio consumers install exact GitHub Release archive URLs, not Git branches or upstream npm packages. The combined release is `studio-preview.2`, package version `0.1.0-studio-preview.2`. Source manifests retain the upstream source version; only staged archive manifests receive the fork version and fixed internal archive URLs. All eleven public packages use one fork version, including Pixi. Archives are private for npm publication, but installable through their GitHub URLs.

Run frozen installation and `pnpm check`, the three example exports, and `pnpm packages:check` first. Commit/push the reviewed source to this fork's main and require CI's three platform checks to pass. From that clean, built commit run:

```sh
pnpm fork:pack /absolute/path/to/a-new-release-directory
```

The command refuses dirty source, another branch, an existing destination, or an already published tag. It packages all public modules, resolves internal dependencies, preserves licenses, and writes `preview-manifest.json`, `SHA256SUMS`, and the packaging sources. It never commits or publishes. Publish a complete release from that exact main commit only after inspecting the archives. Upload all assets to a draft release first, verify completeness/checksums, then publish it. Never replace an existing tag or asset. The inherited npm release and Pages deployment jobs are restricted to the upstream repository.

Install the published URLs in a clean consumer before changing playable dependency pins. Consumers must retain all matching internal fork packages; do not mix upstream and fork runtimes. Commit both package manifest and lockfile. Local-engine connections are temporary and must be restored before adopting the published release. Keep `studio-params-preview.1` intact for rollback; reverting the consumer dependency commit restores its previous pins. Existing Studio-managed workspaces update through their normal reviewed source update flow.

## Configuration and events

Analytics defaults to `false`. Configure destinations, explicit network routes, and declared custom events under the root `analytics` configuration. A missing route or `false` route excludes the active transport for that network. PostHog requires an HTTPS endpoint and its public project ingestion token; never embed personal/admin API keys. Enabling a route does not certify ad-network acceptance of outbound analytics.

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
