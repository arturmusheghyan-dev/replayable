import { MAX_EXPORT_SIZE_BYTES } from '#shared/export-limits.js';
import type { ExportVariantContext } from '#types/context.js';
import {
  validateSnapchatArchive,
  validateSnapchatFiles,
  validateSnapchatJavaScript,
  validateSnapchatVariant,
} from '#validation/networks/snapchat.js';

import { createZipArchive } from '../shared/create-zip-archive.js';
import { prepareSingleHtmlExport } from '../shared/single-html.js';

/** Snapchat owns its runtime and packages a self-contained document with portrait metadata. */
export async function prepareSnapchatExport(context: ExportVariantContext): Promise<Uint8Array> {
  validateSnapchatVariant(context);
  const config = new TextEncoder().encode(JSON.stringify({ portrait: 1 }));
  const html = await prepareSingleHtmlExport(context, {
    maxFileSizeBytes: MAX_EXPORT_SIZE_BYTES - config.byteLength,
    networkName: 'Snapchat',
    validateJavaScript: validateSnapchatJavaScript,
  });
  // Only prepared delivery files are included, never raw build maps or development files.
  const files = [
    { path: 'index.html', data: new TextEncoder().encode(html) },
    { path: 'config.json', data: config },
  ];
  validateSnapchatFiles(files);
  const archive = await createZipArchive(files);
  validateSnapchatArchive(archive);
  return archive;
}
