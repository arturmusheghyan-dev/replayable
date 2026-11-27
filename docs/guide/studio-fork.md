# Studio fork releases and analytics

The maintained Studio engine is `arturmusheghyan-dev/replayable`, branch `main`. It includes the Studio parameter definitions and metadata from `feat/studio-params` together with analytics from `analytics-posthog` and Helix, TikTok and Snapchat delivery support. The old feature branches remain references. Do not merge them wholesale over newer parameter support.

## Distribution

Studio consumers install exact GitHub Release archive URLs, not Git branches or upstream npm packages. The current release is `studio-preview.9`, package version `0.1.0-studio-preview.9`. It adds SDK-absent browser fallback while preserving preview 8 bounded export preparation, analytics and all network validation. Source manifests retain the upstream source version; only staged archive manifests receive the fork version and fixed internal archive URLs. All eleven public packages use one fork version, including Pixi. Archives are private for npm publication, but installable through their GitHub URLs.

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
  buildId: 'my-playable',
  releaseVersion: '0.0.1',
  destinations: {
    pilot: { type: 'posthog', endpoint: 'https://us.i.posthog.com/i/v0/e/', projectToken: 'phc_REPLACE' },
  },
  routes: { preview: 'pilot' },
  events: { tutorial_completed: {}, zones_created: { integer: { min: 0, max: 1000 } } },
}
```

Use `playable.analytics.track('tutorial_completed')` or `playable.analytics.track('zones_created', count)`. Undeclared events, invalid names, and out-of-bounds/noninteger payloads are rejected. The `replayable_` prefix is reserved.

The original automatic events are `replayable_started`, `replayable_first_frame`, `replayable_first_interaction`, `replayable_completed`, and `replayable_cta`. Completion integer values remain success 0, failure 1, skip 2, duration timeout 3, inactivity timeout 4. Events carry session ID, ordered sequence, build ID, creative version, optional release version, network, language, viewport, orientation, and wall-clock elapsed timing. The first visible ready state starts collection; early first interaction is retained. Limits are 32 events per name and 256 per session. Transport failure does not stop gameplay and no delivery success is promised by the no-CORS transport.

## Separate playable and release identifiers

Set `buildId` from the consumer's package name and `releaseVersion` from its package version.
PostHog receives these as `build_id` and `release_version`; its existing `version` property remains
the full creative identifier selected by the runtime, such as `pl114_003`. A release bump therefore
changes only `release_version`. Duplication and promotion can assign a new package identity.

`releaseVersion` is an optional nonempty string. Legacy configurations and fixed build IDs remain
valid; the engine omits the new property when absent and never extracts a release from `buildId`.
This additive property retains event `schema_version: 1`. Every automatic and custom event uses the
same metadata, including terminal beacon delivery. Console logs and the Studio event bridge retain
their existing event-name/value-only output.

Existing PostHog history and already built playables do not change. For historical reporting,
map known legacy `name@release` IDs to the stable name and keep the suffix as release metadata;
do not strip arbitrary identifiers or rewrite events automatically. Rebuild and separately publish
consumers to adopt the new fields. Keep preview 4 packages available for rollback, reverting the
new configuration field together with dependency pins.

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

## Frame rate, effective mute and store attribution (preview 6)

Every automatic and custom event includes `audio_muted`, sampled from the internal applied
mute and the current runtime audio permission. It includes in-game/Studio preview muting,
disabled audio, host volume zero and runtime interaction/visibility restrictions. This describes
runtime suppression, not speaker output, device volume, AudioContext unlock success, or whether
a sound is playing. The public `audio.muted` property still represents the playable preference.

`avg_fps` is cumulative completed frame intervals divided by their total real time, rounded to
two decimals. It is omitted before a usable interval. Sampling starts with rendering after
readiness, excludes browser-hidden/host-paused/stopped intervals, and includes slow foreground
frames. The passive observer adds no scheduling demand and never enables the Stats overlay.
The frame metric describes runtime frame cadence, not GPU completion or display refresh.
Sampling continues through completion/end-card rendering for subsequent CTA events.

`playable.openStore({ source: 'persistent_cta' })` reports `cta_source` only on
`replayable_cta`. The exported `PlayableCtaSource` type supports `persistent_cta`, `cta_endcard`,
`banner`, `teaser_tap`, `gameplay_tap`, `auto_redirect`, and `unknown`. Existing no-argument calls
report `unknown`. Source attribution never changes host store routing or implies completion.
For declared custom events, `playable.analytics.setEventContext(name, properties)` replaces
event-specific string context. Set it before tracking the event; pass `null` to clear it.
The context is copied into HTTP payload properties, not into the event name or integer value:

```ts
playable.analytics.setEventContext('intro_completed', { active_skin: 'burger' });
playable.analytics.track('intro_completed', durationMs);
```

Context is local to the runtime session and applies only to the named event. Clear it when a
playable starts a fresh run. Keys use lowercase letters, digits and underscores, start with
a letter, and contain at most 80 characters. Non-string values and reserved transport/engine
fields are ignored, including optional metadata when absent. Disabled analytics remains inert.

Custom `analytics.track(name, integerValue?)`, console log lines, schema version 1, event limits,
and the disabled-analytics path are unchanged. PostHog fetch and terminal beacon use the same
properties. Logs/Studio's existing observer continue showing event names and integer values only.

Completion retains success 0, failure 1, skip 2, duration timeout 3, inactivity timeout 4.
Consumers must report the real terminal gameplay outcome once, before a noninteractive teaser,
and must not infer success merely from showing an end card or requesting a store redirect.
Old exports retain their old payloads until rebuilt; publishing packages does not migrate consumers.

## Large export matrices (preview 8)

Export prepares and writes at most two variants concurrently. Completed payloads are
released after their staged writes; only ordered filenames, IDs and byte sizes remain
in memory. No CLI/configuration changes or increased Node heap allowance are required.
The public export API and network formats/limits are unchanged.

Temporary sibling directories use the reserved `.replayable-exports-*` prefix. Ignore
this generated prefix in source control. On an awaited failure, workers settle before
cleanup; previous exports remain intact until the complete replacement is ready. If
replacement rollback fails, the error identifies the retained backup. Never delete that
recovery copy automatically. Abrupt process termination may leave staging on disk;
this is not a crash-recovery journal or a lock against concurrent standalone exporters.

Adopt all declared Replayable packages and lockfile pins together. Keep preview 7 for
rollback. PL133 is the initial adoption target; templates and other playables are not
automatically upgraded. This release does not change playable release numbers or
publish their previews.

## Browser fallback (preview 9)

Rebuilt ad-network exports can run without an advertising SDK on a local file or
ordinary HTTP/HTTPS host. No hostname or user-agent allowlist is used. After document
bootstrap, the adapter selects its environment once: an absent host uses browser
visibility, viewport and interaction-gated audio; a present host keeps its original
readiness, viewability, volume and campaign CTA behavior. A loading or malformed SDK
never falls back after a timeout or error. No SDK globals or host callbacks are faked.
SDKs injected asynchronously after document bootstrap are outside this detection
contract; their integration must make the SDK available before playable initialization.

Browser fallback preserves the configured network identity and console analytics logs,
but suppresses all outbound Replayable analytics, including completion and CTA events.
This does not alter explicitly configured analytics on the Preview network or third-party
gameplay scripts. Real host delivery retains its configured analytics routes.

Browser CTA opens the configured store URL where the network's export rules permit it.
Snapchat and Moloco instead log the CTA: their artifacts must not contain redirect code.
With an SDK, every network retains its original API, including Liftoff's campaign-owned
argumentless open and Mintegral/TikTok's install callback. Browser popup restrictions and
user-interaction requirements still apply.

Double-click self-contained HTML exports to test them locally. For ZIP formats, extract
all files together and serve the folder over HTTP/HTTPS; module/resource archives are
not guaranteed to work through file URLs. Upload the same files to a static host for
hosted testing. A missing network-owned script such as mraid.js can appear in the browser
console outside an ad host; the fallback does not supply a counterfeit SDK. Native SDK
scripts, validators, formats, size limits and network restrictions remain unchanged.

The browser fallback builds passed user testing locally and hosted on 27 November 2026.
It is included in studio-preview.9; existing exports and consumers on older pins do not
change. Adopt all eleven matching fork packages through exact release URLs. Template
main and template/gameplay adopt this release; other playables keep their existing pins.
Keep studio-preview.8 available for rollback. Browser fallback testing does not certify
acceptance by an ad network.
