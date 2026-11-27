# @replayablejs/runtime

Manage host readiness, assets, screen state, audio, updates, completion and store actions.

Part of [Replayable](https://github.com/replayablejs/replayable) **0.1.0-alpha.0**.
APIs may change during the alpha series.

## Install

```sh
pnpm add @replayablejs/runtime@0.1.0-alpha.0
```

## Public surface

`playable` and runtime types. Subpaths: `/assets` for generated asset contracts and `/shell` for shell element IDs.

[Usage and reference](https://github.com/replayablejs/replayable/blob/main/docs/reference/runtime.md).
The package manifest defines supported import paths; internal source files are not public APIs.

## Development

From the repository root, install with `pnpm install --frozen-lockfile` and build dependencies
with `pnpm build`. Run `pnpm --filter @replayablejs/runtime test` for this package's tests.

## License

Original code is [MIT licensed](https://github.com/replayablejs/replayable/blob/main/LICENSE). Bundled third-party resources retain
their accompanying license terms.

## Studio fork analytics

Optional analytics is disabled by default and routed explicitly per network. The current main branch preserves Studio structured parameters alongside the public `playable.analytics.track` API. See [configuration, events and fork package releases](../../docs/guide/studio-fork.md).

The current source supports simple console analytics logs and independent sending controls, globally or per network. Logs contain only the event name and optional integer value. Log-only variants do not initialize a network transport. These settings require fork release `studio-preview.3` or later.

## Browser fallback (preview 9)

Network adapters select browser lifecycle behavior when their host SDK is absent after
bootstrap. Present SDKs keep native readiness, visibility, volume and CTA handling.
Fallback sessions suppress outbound analytics while preserving configured console logs.
Snapchat/Moloco fallback CTAs log only; other supported networks can open the store URL.
See the [fallback contract and testing instructions](../../docs/guide/studio-fork.md#browser-fallback-preview-9).
