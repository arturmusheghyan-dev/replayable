import { createVariants, defineConfig, type ReplayableConfigInput } from '@replayablejs/config';
import { expect, it } from 'vitest';

import { resolvePlayableProfile } from '../src/networks/network-profiles.js';
import { createRuntimeDefine } from '../src/runtime/create-runtime-define.js';

const input = {
  name: 'networks',
  assets: { sourceDir: 'assets', outDir: 'generated', assets: {}, emit: { assets: 'assets.ts' } },
  localization: { fallback: 'en', languages: ['en', 'fr'] },
  versions: { first: {}, second: {} },
  screen: {
    orientations: {
      portrait: { enabled: true, width: 400, height: 800, ratio: { min: 0.4, max: 0.8 } },
      landscape: { enabled: true, width: 800, height: 400, ratio: { min: 1.2, max: 2.4 } },
    },
    resolution: {
      pixelRatio: { min: 1, max: 2 },
      renderScale: { minimal: 0.5, reduced: 0.6, balanced: 0.8, full: 1 },
    },
  },
  store: { androidUrl: 'https://example.com/android', iosUrl: 'https://example.com/ios' },
} satisfies ReplayableConfigInput;

it.each([
  ['adn', 'applovin'],
  ['tiktok', 'mintegral'],
] as const)(
  '%s independently selects the %s implementation without changing runtime identity',
  (network, runtime) => {
    const config = defineConfig({ ...input, networks: { [network]: {} } });
    const variants = createVariants(config);
    expect(variants).toHaveLength(4);
    for (const variant of variants) {
      const profile = resolvePlayableProfile(variant);
      expect(profile.runtime).toBe(runtime);
      const definition = JSON.parse(
        createRuntimeDefine(variant, profile).REPLAYABLE_RUNTIME_DEFINITION!,
      );
      expect(definition.config).toMatchObject({ network, id: variant.id });
      expect(variant.id).toBe(`${variant.version}/${network}/${variant.localization.language}`);
    }
  },
);

it('reuses profile behavior alongside the source networks while preserving distinct variants', () => {
  const variants = createVariants(
    defineConfig({ ...input, networks: { adn: {}, applovin: {}, tiktok: {}, mintegral: {} } }),
  );
  const find = (network: string) => variants.find((v) => v.network === network)!;
  expect(variants).toHaveLength(16);
  expect(resolvePlayableProfile(find('adn'))).toEqual(resolvePlayableProfile(find('applovin')));
  expect(resolvePlayableProfile(find('tiktok'))).toEqual(resolvePlayableProfile(find('mintegral')));
});

it('limits only the Snapchat runtime to the authored portrait layout', () => {
  const config = defineConfig({ ...input, networks: { snapchat: {}, meta: {} } });
  for (const variant of createVariants(config)) {
    const profile = resolvePlayableProfile(variant);
    const definition = JSON.parse(
      createRuntimeDefine(variant, profile).REPLAYABLE_RUNTIME_DEFINITION!,
    );
    expect(definition.config.screen.orientations.portrait).toEqual(
      config.screen.orientations.portrait,
    );
    expect(definition.config.screen.orientations.landscape.enabled).toBe(
      variant.network !== 'snapchat',
    );
    expect(profile).toMatchObject({
      runtime: variant.network,
      loadingIndicator: 'replayable',
      endCard: { interaction: variant.network === 'snapchat' ? 'cta-only' : 'full-screen' },
    });
  }
  expect(config.screen.orientations.landscape.enabled).toBe(true);
});

it('rejects Snapchat without portrait support and with outbound analytics', () => {
  const [variant] = createVariants(defineConfig({ ...input, networks: { snapchat: {} } }));
  expect(() =>
    resolvePlayableProfile({
      ...variant!,
      screen: {
        ...variant!.screen,
        orientations: {
          ...variant!.screen.orientations,
          portrait: { ...variant!.screen.orientations.portrait, enabled: false },
        },
      },
    }),
  ).toThrow('portrait');
  expect(() =>
    resolvePlayableProfile({
      ...variant!,
      analytics: {
        buildId: 'test',
        events: {},
        destination: { type: 'posthog', endpoint: 'https://example.com', projectToken: 'phc_test' },
      },
    }),
  ).toThrow('outbound analytics');
});
