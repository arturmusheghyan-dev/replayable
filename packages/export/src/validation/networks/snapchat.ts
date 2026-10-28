import { basename } from 'node:path';

import { load } from 'cheerio';

import { MAX_EXPORT_SIZE_BYTES } from '#shared/export-limits.js';
import type { ExportVariantContext } from '#types/context.js';
import type { ExportFile } from '#types/export-file.js';

import { containsBrowserRedirect } from '../browser-redirects.js';

/** Validate authored capabilities again when exporting an existing build. */
export function validateSnapchatVariant(context: ExportVariantContext): void {
  rejectMraid(basename(context.outputFile));
  if (!context.variant.screen.orientations.portrait.enabled) {
    throw new Error('Snapchat requires an enabled portrait layout.');
  }
  if (context.variant.analytics !== false) {
    throw new Error('Snapchat does not support outbound analytics. Disable its analytics route.');
  }
}

/** Inspect prepared, readable code before compression can conceal prohibited APIs. */
export function validateSnapchatJavaScript(sources: readonly string[]): void {
  for (const source of sources) {
    rejectMraid(source);
    if (containsBrowserRedirect(source)) {
      throw new Error('Snapchat export contains a direct JavaScript redirect.');
    }
  }
}

/** Check the exact root files and aggregate uncompressed delivery bytes. */
export function validateSnapchatFiles(files: readonly ExportFile[]): void {
  if (
    files.length !== 2 ||
    !files.some(({ path }) => path === 'index.html') ||
    !files.some(({ path }) => path === 'config.json')
  ) {
    throw new Error('Snapchat export requires only index.html and config.json at the ZIP root.');
  }
  const totalBytes = files.reduce((sum, file) => sum + file.data.byteLength, 0);
  validateSize(totalBytes, 'uncompressed files');
  for (const file of files) {
    rejectMraid(file.path);
    const source = new TextDecoder().decode(file.data);
    rejectMraid(source);
    if (file.path === 'config.json') {
      const config: unknown = JSON.parse(source);
      if (
        config === null ||
        typeof config !== 'object' ||
        Object.keys(config).length !== 1 ||
        !('portrait' in config) ||
        config.portrait !== 1
      ) {
        throw new Error('Snapchat config.json must contain {"portrait":1}.');
      }
    } else {
      const document = load(source);
      if (
        document('meta[http-equiv]')
          .toArray()
          .some((element) => document(element).attr('http-equiv')?.toLowerCase() === 'refresh')
      ) {
        throw new Error('Snapchat export contains a document redirect.');
      }
      const scripts = document('script:not([src])')
        .toArray()
        .filter((element) => {
          const type = document(element).attr('type')?.toLowerCase();
          return (
            type === undefined ||
            type === '' ||
            type === 'module' ||
            type === 'text/javascript' ||
            type === 'application/javascript'
          );
        })
        .map((element) => document(element).text());
      validateSnapchatJavaScript(scripts);
    }
  }
}

/** ZIP overhead is included in the compressed delivery limit. */
export function validateSnapchatArchive(archive: Uint8Array): void {
  validateSize(archive.byteLength, 'ZIP');
}

function rejectMraid(source: string): void {
  if (source.toLowerCase().includes('mraid')) {
    throw new Error('Snapchat export must not contain mraid.');
  }
}

function validateSize(bytes: number, subject: string): void {
  if (bytes > MAX_EXPORT_SIZE_BYTES) {
    throw new Error(
      `Snapchat ${subject} exceed the 5 MB limit: ${bytes.toLocaleString('en-US')} bytes.`,
    );
  }
}
