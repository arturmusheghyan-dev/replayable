import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { writeExportArtifacts } from '../src/emission/write-export-artifacts.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    writeFile: vi.fn<typeof fs.writeFile>(actual.writeFile),
    rename: vi.fn<typeof fs.rename>(actual.rename),
  };
});

let directory: string;
let outputDirectory: string;

beforeEach(async () => {
  vi.mocked(fs.writeFile).mockReset();
  vi.mocked(fs.rename).mockReset();
  directory = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'replayable-export-test-')));
  outputDirectory = join(directory, 'export');
  await fs.mkdir(outputDirectory);
  await fs.writeFile(join(outputDirectory, 'previous.html'), 'previous');
});

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});

async function emit() {
  const variants = await writeExportArtifacts(outputDirectory, async (staging) => {
    await fs.writeFile(join(staging, 'preview_default_en.html'), 'new export');
    return [
      {
        file: join(outputDirectory, 'preview_default_en.html'),
        size: 10,
        variantId: 'default/preview/en',
      },
    ];
  });
  return { variants };
}

it('replaces successful exports and removes staging files', async () => {
  const result = await emit();
  expect(result.variants[0]?.size).toBe(10);
  expect(await fs.readdir(outputDirectory)).toEqual(['preview_default_en.html']);
  expect(await fs.readdir(directory)).toEqual(['export']);
});

it('keeps previous exports when a staged write fails', async () => {
  vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('disk full'));
  await expect(emit()).rejects.toThrow('disk full');
  expect(await fs.readFile(join(outputDirectory, 'previous.html'), 'utf8')).toBe('previous');
  expect(await fs.readdir(directory)).toEqual(['export']);
});

it('restores previous exports when replacement fails', async () => {
  const actual = await vi.importActual<typeof fs>('node:fs/promises');
  vi.mocked(fs.rename)
    .mockImplementationOnce(actual.rename)
    .mockRejectedValueOnce(new Error('commit failed'));
  await expect(emit()).rejects.toThrow('commit failed');
  expect(await fs.readFile(join(outputDirectory, 'previous.html'), 'utf8')).toBe('previous');
});

it('preserves the backup and reports its location when restoration fails', async () => {
  const actual = await vi.importActual<typeof fs>('node:fs/promises');
  vi.mocked(fs.rename)
    .mockImplementationOnce(actual.rename)
    .mockRejectedValueOnce(new Error('commit failed'))
    .mockRejectedValueOnce(new Error('restore failed'));
  await expect(emit()).rejects.toThrow('Previous exports remain at');
  const [staging] = await fs.readdir(directory);
  expect(staging).toBeDefined();
  expect(await fs.readFile(join(directory, staging ?? '', 'previous/previous.html'), 'utf8')).toBe(
    'previous',
  );
});

it('supports a first export without an existing destination', async () => {
  await fs.rm(outputDirectory, { recursive: true });
  await emit();
  expect(await fs.readFile(join(outputDirectory, 'preview_default_en.html'), 'utf8')).toBe(
    'new export',
  );
});

it('rejects a destination redirected before staging', async () => {
  const outside = join(directory, 'other');
  await fs.mkdir(outside);
  await fs.writeFile(join(outside, 'keep.html'), 'unrelated');
  await fs.rename(outputDirectory, join(directory, 'original'));
  await fs.symlink(outside, outputDirectory, 'junction');
  await expect(emit()).rejects.toThrow('redirected export directory');
  expect(await fs.readFile(join(outside, 'keep.html'), 'utf8')).toBe('unrelated');
  expect(
    (await fs.readdir(directory)).some((name) => name.startsWith('.replayable-exports-')),
  ).toBe(false);
});

it('rechecks redirection after preparation without moving another destination', async () => {
  const outside = join(directory, 'other');
  await fs.mkdir(outside);
  await fs.writeFile(join(outside, 'keep.html'), 'unrelated');
  await expect(
    writeExportArtifacts(outputDirectory, async (staging) => {
      await fs.writeFile(join(staging, 'new.html'), 'new');
      await fs.rename(outputDirectory, join(directory, 'original'));
      await fs.symlink(outside, outputDirectory, 'junction');
      return [];
    }),
  ).rejects.toThrow('redirected export directory');
  expect(await fs.readFile(join(outside, 'keep.html'), 'utf8')).toBe('unrelated');
  expect(await fs.readFile(join(directory, 'original', 'previous.html'), 'utf8')).toBe('previous');
  expect(
    (await fs.readdir(directory)).some((name) => name.startsWith('.replayable-exports-')),
  ).toBe(false);
});
