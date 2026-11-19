import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createVariants, defineConfig } from '@replayablejs/config';
import { afterEach, expect, it, vi } from 'vitest';

import { emitExportProject } from '../src/emission/emit-export-project.js';
import { preparePreviewExport } from '../src/preparation/networks/preview.js';
import { prepareExportProject } from '../src/preparation/prepare-export-project.js';
import type { ExportProjectContext } from '../src/types/context.js';

vi.mock('../src/preparation/networks/preview.js', () => ({
  preparePreviewExport: vi.fn<typeof preparePreviewExport>(),
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
} satisfies Parameters<typeof defineConfig>[0];

function project(count: number, outputDirectory = '/unused'): ExportProjectContext {
  return {
    outputDirectory,
    variants: Array.from({ length: count }, (_, index) => ({
      buildDirectory: '/unused',
      outputFile: join(outputDirectory, `${index}.html`),
      variant: {
        ...createVariants(defineConfig({ ...base, networks: { preview: {} } }))[0],
        id: String(index),
      },
    })),
  };
}
function gate() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

afterEach(() => vi.resetAllMocks());

it('bounds preparation plus writing to two workers and returns ordered metadata only', async () => {
  const firstWrite = gate();
  const secondPreparation = gate();
  let active = 0,
    maximum = 0;
  const written: string[] = [];
  vi.mocked(preparePreviewExport).mockImplementation(async (context) => {
    active++;
    maximum = Math.max(maximum, active);
    if (context.variant.id === '1') {
      await secondPreparation.promise;
    }
    return 'é';
  });
  const pending = prepareExportProject(project(6), async (artifact) => {
    if (artifact.variantId === '0') {
      await firstWrite.promise;
    }
    written.push(artifact.variantId);
    active--;
  });
  await vi.waitFor(() => expect(preparePreviewExport).toHaveBeenCalledTimes(2));
  expect(written).toEqual([]);
  firstWrite.release();
  await vi.waitFor(() => expect(written).toEqual(['0', '2', '3', '4', '5']));
  secondPreparation.release();
  const results = await pending;
  expect(maximum).toBe(2);
  expect(results.map((item) => item.variantId)).toEqual(['0', '1', '2', '3', '4', '5']);
  for (const result of results) {
    expect(result.size).toBe(2);
    expect(Object.keys(result).sort()).toEqual(['file', 'size', 'variantId']);
  }
});

it('supports an empty selection without scheduling preparation', async () => {
  expect(await prepareExportProject(project(0), async () => {})).toEqual([]);
  expect(preparePreviewExport).not.toHaveBeenCalled();
});

it.each(['prepare', 'write'])(
  'settles the other worker before cleanup after %s failure',
  async (stage) => {
    const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'bounded-export-')));
    const output = join(root, 'exports');
    const late = gate();
    const failure = new Error(`${stage} failed`);
    await fs.mkdir(output);
    await fs.writeFile(join(output, 'old.html'), 'previous');
    const unrelated = join(root, '.replayable-exports-unrelated');
    await fs.mkdir(unrelated);
    await fs.writeFile(join(unrelated, 'recovery'), 'keep');
    vi.mocked(preparePreviewExport).mockImplementation(async (context) => {
      if (context.variant.id === '0') {
        if (stage === 'prepare') {
          throw failure;
        }
        // A directory at the reviewed filename forces the staged write to fail.
        const staging = (await fs.readdir(root)).find(
          (name) =>
            name.startsWith('.replayable-exports-') && name !== '.replayable-exports-unrelated',
        );
        await fs.mkdir(join(root, staging!, 'prepared', '0.html'));
      } else {
        await late.promise;
      }
      return 'new';
    });
    try {
      const pending = emitExportProject(project(5, output));
      // Attach rejection handling before releasing the slow worker.
      const outcome = pending.then(
        () => undefined,
        (error: unknown) => error,
      );
      await vi.waitFor(() => expect(preparePreviewExport).toHaveBeenCalledTimes(2));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(await fs.readFile(join(output, 'old.html'), 'utf8')).toBe('previous');
      expect((await fs.readdir(root)).length).toBe(3);
      late.release();
      const error = await outcome;
      expect(error).toBeInstanceOf(Error);
      expect(error instanceof Error ? error.message : 'No error').toMatch(
        stage === 'prepare' ? /prepare failed/ : /EISDIR|illegal operation|directory/i,
      );
      expect(preparePreviewExport).toHaveBeenCalledTimes(2);
      expect((await fs.readdir(root)).sort()).toEqual(['.replayable-exports-unrelated', 'exports']);
      expect(await fs.readFile(join(unrelated, 'recovery'), 'utf8')).toBe('keep');
      expect(await fs.readFile(join(output, 'old.html'), 'utf8')).toBe('previous');
    } finally {
      late.release();
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
