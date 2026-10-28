import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { createVariants, defineConfig, type ReplayableConfigInput } from '@replayablejs/config';
import { strFromU8, unzipSync } from 'fflate';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { exportProject } from '../src/pipeline/export-project.js';
import {
  validateSnapchatArchive,
  validateSnapchatFiles,
} from '../src/validation/networks/snapchat.js';

vi.mock('../src/preparation/shared/load-compressed-module-loader.js', () => ({
  loadCompressedModuleLoader: async (): Promise<string> => 'void 0;',
}));

const base = {
  name: 'PO2',
  assets: { sourceDir: 'assets', outDir: 'generated', assets: {}, emit: { assets: 'assets.ts' } },
  localization: { fallback: 'en', languages: ['en'] },
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
let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'replayable-network-export-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const roles = ['host', 'config', 'assets', 'application'];
function html(extra = ''): string {
  return (
    '<!doctype html><html><head>' +
    extra +
    '</head><body>' +
    roles
      .map(
        (role) =>
          `<script type="module" data-replayable-entry="${role}" src="${role}.js"></script>`,
      )
      .join('') +
    '</body></html>'
  );
}

async function fixture(overrides: Partial<ReplayableConfigInput> = {}) {
  const config = defineConfig({ ...base, networks: { snapchat: {} }, ...overrides });
  for (const variant of createVariants(config)) {
    const directory = join(root, 'dist', variant.id);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), html());
    for (const role of roles) {
      const source =
        role === 'host'
          ? variant.network === 'snapchat'
            ? 'window.ScPlayableAd.onCTAClick();'
            : variant.network === 'adn' || variant.network === 'applovin'
              ? 'mraid.open("https://example.com");'
              : variant.network === 'meta'
                ? 'FbPlayableAd.onCTAClick();'
                : 'window.gameReady?.(); window.gameEnd?.(); window.install?.();'
          : role === 'config'
            ? `globalThis.fixtureNetwork = ${JSON.stringify(variant.network)};`
            : 'void 0;';
      await writeFile(join(directory, `${role}.js`), source);
    }
  }
  return config;
}

it.each(['adn', 'tiktok', 'snapchat'] as const)(
  'exports %s without requiring a source-network build',
  async (network) => {
    const config = await fixture({ networks: { [network]: {} } });
    const result = await exportProject(config, { projectRoot: root });
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].variantId).toBe(`default/${network}/en`);
    expect(basename(result.variants[0].file)).toBe(
      `${network}_default_en.${network === 'adn' ? 'html' : 'zip'}`,
    );
  },
);

it('keeps destination identity and custom labels across a mixed version/language matrix', async () => {
  const config = await fixture({
    versions: { pl103_001: {}, pl103_002: {} },
    localization: { fallback: 'en', languages: ['en', 'fr'] },
    networks: { meta: {}, applovin: {}, adn: {}, mintegral: {}, tiktok: {}, snapchat: {} },
    export: {
      filename: ({ name, version, network, language }) =>
        `${name}_${version.toUpperCase()}_${network === 'meta' ? 'facebook' : network}_${language}`,
    },
  });
  const result = await exportProject(config, { projectRoot: root });
  const variants = createVariants(config);
  expect(result.variants).toHaveLength(24);
  expect(result.variants.map((v) => v.variantId)).toEqual(variants.map((v) => v.id));
  for (const artifact of result.variants) {
    const variant = variants.find((v) => v.id === artifact.variantId)!;
    const bytes = await readFile(artifact.file);
    const contents = artifact.file.endsWith('.zip')
      ? Object.values(unzipSync(bytes))
          .map((entry) => strFromU8(entry))
          .join('\n')
      : bytes.toString();
    expect(contents).toMatch(new RegExp(`fixtureNetwork=['"]${variant.network}['"]`));
    expect(basename(artifact.file)).toContain(
      `_${variant.network === 'meta' ? 'facebook' : variant.network}_`,
    );
  }
});

it('packages only the Snapchat delivery files, excluding maps and development files', async () => {
  const config = await fixture();
  await writeFile(
    join(root, 'dist/default/snapchat/en/application.js.map'),
    'mraid development source',
  );
  await writeFile(join(root, 'dist/default/snapchat/en/debug.txt'), 'debug');
  const result = await exportProject(config, { projectRoot: root });
  const files = unzipSync(await readFile(result.variants[0].file));
  expect(Object.keys(files).sort()).toEqual(['config.json', 'index.html']);
  expect(JSON.parse(strFromU8(files['config.json']))).toEqual({ portrait: 1 });
  expect(strFromU8(files['index.html'])).toContain('ScPlayableAd.onCTAClick()');
});

it.each([
  [
    'application.js',
    'globalThis.forbidden = "MrAiD";' + 'console.log("compress me");'.repeat(500),
    'must not contain mraid',
  ],
  ['application.js', 'window.location.href = "https://example.com";', 'direct JavaScript redirect'],
  [
    'index.html',
    html('<script>window.open("https://example.com");</script>'),
    'direct JavaScript redirect',
  ],
  [
    'index.html',
    html('<meta http-equiv="refresh" content="0;url=https://example.com">'),
    'document redirect',
  ],
  ['index.html', html('<img src="https://example.com/image.png">'), 'non-embedded resources'],
  [
    'index.html',
    html('<style>@import "https://example.com/style.css";</style>'),
    'unavailable resources',
  ],
  ['index.html', html('<!-- MrAiD -->'), 'must not contain mraid'],
])('rejects invalid Snapchat %s and preserves prior exports', async (path, content, error) => {
  const config = await fixture();
  await mkdir(join(root, 'exports'));
  await writeFile(join(root, 'exports/previous.html'), 'keep this export');
  await writeFile(join(root, 'dist/default/snapchat/en', path), content);
  await expect(exportProject(config, { projectRoot: root })).rejects.toThrow(error);
  expect(await readdir(join(root, 'exports'))).toEqual(['previous.html']);
  expect(await readFile(join(root, 'exports/previous.html'), 'utf8')).toBe('keep this export');
});

it('rejects a prohibited Snapchat archive filename before replacing prior exports', async () => {
  const config = await fixture({ export: { filename: () => 'MrAiD_campaign' } });
  await mkdir(join(root, 'exports'));
  await writeFile(join(root, 'exports/previous.html'), 'keep');
  await expect(exportProject(config, { projectRoot: root })).rejects.toThrow(
    'must not contain mraid',
  );
  expect(await readdir(join(root, 'exports'))).toEqual(['previous.html']);
  expect(await readFile(join(root, 'exports/previous.html'), 'utf8')).toBe('keep');
});

it('checks Snapchat delivery filenames without inspecting unrelated parent folder names', async () => {
  const config = await fixture();
  const result = await exportProject(config, {
    projectRoot: root,
    outputDirectory: join(root, 'mraid-research'),
  });
  expect(basename(result.variants[0].file)).toBe('snapchat_default_en.zip');
});

it('preserves previous exports when a selected build is absent', async () => {
  const config = await fixture({ networks: { adn: {}, tiktok: {} } });
  await rm(join(root, 'dist/default/tiktok/en/index.html'));
  await mkdir(join(root, 'exports'));
  await writeFile(join(root, 'exports/previous.html'), 'keep');
  await expect(exportProject(config, { projectRoot: root })).rejects.toThrow(
    'Missing build for default/tiktok/en',
  );
  expect(await readFile(join(root, 'exports/previous.html'), 'utf8')).toBe('keep');
});

it('rejects incompatible Snapchat capabilities on export', async () => {
  const config = await fixture();
  await expect(
    exportProject(
      {
        ...config,
        screen: {
          ...config.screen,
          orientations: {
            ...config.screen.orientations,
            portrait: { ...config.screen.orientations.portrait, enabled: false },
          },
        },
      },
      { projectRoot: root },
    ),
  ).rejects.toThrow('portrait');
  await expect(
    exportProject(
      {
        ...config,
        analytics: {
          buildId: 'TEST',
          destinations: {
            test: { type: 'posthog', endpoint: 'https://example.com', projectToken: 'phc_test' },
          },
          routes: { snapchat: 'test' },
        },
      },
      { projectRoot: root },
    ),
  ).rejects.toThrow('outbound analytics');
});

function sizedSnapchatFiles(size: number) {
  const metadata = new TextEncoder().encode('{"portrait":1}');
  const document = new TextEncoder().encode(
    '<!doctype html>é' +
      ' '.repeat(size - metadata.byteLength - Buffer.byteLength('<!doctype html>é')),
  );
  return [
    { path: 'index.html', data: document },
    { path: 'config.json', data: metadata },
  ];
}

it.each([4_999_999, 5_000_000])('accepts Snapchat aggregate and ZIP bytes at %i', (size) => {
  expect(() => validateSnapchatFiles(sizedSnapchatFiles(size))).not.toThrow();
  expect(() => validateSnapchatArchive(new Uint8Array(size))).not.toThrow();
});

it('rejects Snapchat aggregate and ZIP bytes one byte over the limit', () => {
  expect(() => validateSnapchatFiles(sizedSnapchatFiles(5_000_001))).toThrow('5 MB limit');
  expect(() => validateSnapchatArchive(new Uint8Array(5_000_001))).toThrow('5 MB limit');
});
