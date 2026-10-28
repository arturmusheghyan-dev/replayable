# Export

`@replayablejs/export` exports existing playable builds. The public operation is
`exportProject(config, { projectRoot, outputDirectory? })`. The destination defaults to `exports`.
The result lists each variant's ID, artifact path and final size in bytes.

Run build first. Export does not regenerate application code or source assets. The CLI equivalent
is `replayable export`, with `--output` to choose a destination.

## Implemented profiles

Profiles are preview, AppLovin, Helix (`adn`), Google, Liftoff, Meta, Mintegral, TikTok, Snapchat,
Moloco and Unity. The exporter
prepares each network's HTML or ZIP form, checks its resources and applies implemented delivery
rules. Outputs use names such as `preview_default_en.html` and `google_default_en.zip`.

The shared size ceiling is 5,000,000 bytes. Moloco requires strictly less than that value;
other size checks accept the boundary. Liftoff applies the limit to entry HTML. Google also
limits archive contents to 512 files. These are code-enforced limits, not a promise of current
network acceptance or a substitute for testing in the destination's tools.

The exporter is the delivery validator; there is no separate public artifact-inspection API.
Keep required third-party notices according to the resources' terms. Do not assume that exporting
a playable clears redistribution rights or supplies every resource's required attribution.

[Export pipeline](https://github.com/replayablejs/replayable/tree/main/packages/export/src/pipeline)
and [network validators](https://github.com/replayablejs/replayable/tree/main/packages/export/src/validation/networks).

## Delivery Workflow

1. Select campaign networks, languages and creative versions in project configuration.
2. Build the project with that configuration.
3. Run export with the same configuration and inspect any reported validation failure.
4. Test the resulting HTML or ZIP in its destination's tools.

Changing source files after building leaves the existing build unchanged. Rebuild before exporting
when code, assets or configuration have changed.

## Output and Failures

Use a dedicated export directory. Artifact names combine network, creative version and language,
so `google_default_en.zip` identifies the Google profile, default creative and English language.
The programmatic result contains the final artifact paths and byte sizes for successful exports.

If an artifact exceeds its limit, adjust the source assets or their processor settings and rebuild.
Start with large images, audio and optional resources. Moving an asset into a secondary bundle
changes when it loads; it does not make its bytes disappear from delivery.

If a required build file is missing, confirm the build directory and that both operations used the
same project root and configuration. See [Build and Export](../guide/build-and-export.md) for the
command-line workflow.

## Helix, TikTok and Snapchat

Helix (`adn`) uses the AppLovin build profile, MRAID adapter and HTML exporter. TikTok
(`tiktok`) uses the Mintegral profile, host-controlled lifecycle and ZIP exporter. Each selected
network gets its own configured build: runtime and analytics report the selected delivery
network, and its parameters, assets and completion settings remain independent. These are shared
implementations, not byte-identical renamed files. Selecting either network works without also
selecting AppLovin or Mintegral.

Check Helix readiness and its store CTA in the ADN test app. When VGP reports that the exact
file already exists, attach the Helix variant separately through **Attach variants**.

TikTok output targets the manual **Adapt Playable Asset** upload workflow. Use that upload flow,
select the supported orientation, and verify gameplay start and the CTA in TikTok's preview.
This is a Mintegral-compatible integration, not a verified native TikTok SDK implementation.
The [TikTok upload guide](https://ads.tiktok.com/resources/help/article/how-to-create-tiktok-pangle-playable-ads?lang=en)
describes adaptation and its preview CTA confirmation. Real network acceptance remains a manual
check; browser simulations cannot establish it.

Snapchat (`snapchat`) uses its own browser-lifecycle adapter and calls
`window.ScPlayableAd.onCTAClick()` for store actions. It derives portrait-only runtime settings
from the authored portrait layout without changing other networks. Missing portrait support or
an enabled outbound analytics route fails validation. A missing host CTA API reports an error.

Its ZIP contains only `index.html` and `config.json` with `{"portrait":1}` at the root, following
the [Voodoo Snapchat packaging convention](https://github.com/VoodooTeam/playable-vsdk/blob/3af17e77611e058a473360c4c7465279b28d9c2a/packages/bundler/src/renderers/renderers/SnapchatPlayableRenderer.ts).
Both the ZIP and its total uncompressed files must be at most 5,000,000 bytes. Export validates
embedded resources and rejects `mraid` case-insensitively, direct JavaScript redirects and
meta-refresh navigation. Prepared JavaScript is inspected before optional compression; raw
source maps and development files are not packaged. Static checks do not analyze arbitrary
dynamic code or prove acceptance in Snap's upload tools.

## Project-specific filename labels

Set an optional `exportName` on each network. The network key remains the delivery identity;
the label only controls its filename segment:

```ts
networks: {
  meta: { exportName: 'facebook' },
  adn: {},
  snapchat: {},
  tiktok: {},
},
export: {
  filename: ({ name, version, exportName, language }) =>
    `${name.toUpperCase()}_${version.toUpperCase()}_${exportName}_${language}`,
},
```

For project `PO2`, version `pl103_001` and language `en`, this produces
`PO2_PL103_001_facebook_en.html`, `PO2_PL103_001_adn_en.html`,
`PO2_PL103_001_snapchat_en.zip`, and `PO2_PL103_001_tiktok_en.zip`.
Meta still reports `meta` in runtime, analytics and catalog metadata. Labels are never
used to select an adapter, change build directories or choose the extension.

The default filename template is `{exportName}_{version}_{language}`. Omitted labels
resolve to the network ID, preserving previous filenames. Existing callbacks keep the
original `network` input; use the additional `exportName` input to opt into configured
labels. String templates can likewise use `{exportName}`, while `{network}` always
means the internal ID. Callbacks preserve the label's casing; string templates retain
their existing lowercase and underscore normalization.

For projects that calculate labels dynamically, the existing callback still supports a
label map without network settings:

```ts
import type { ReplayableNetwork } from '@replayablejs/config';

const labels: Partial<Record<ReplayableNetwork, string>> = { meta: 'facebook' };
const exportOptions = {
  filename: ({ name, version, network, language }) =>
    `${name.toUpperCase()}_${version.toUpperCase()}_${labels[network] ?? network}_${language}`,
} satisfies import('@replayablejs/config').ReplayableExportInput;
```

The engine chooses the extension; labels and callbacks must omit it and cannot supply
directories or unsafe filename characters. Exact, case-only and Unicode-normalization
filename collisions are rejected before emission.
