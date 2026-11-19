import { prepareAppLovinExport } from '#preparation/networks/applovin.js';
import { prepareGoogleExport } from '#preparation/networks/google.js';
import { prepareLiftoffExport } from '#preparation/networks/liftoff.js';
import { prepareMetaExport } from '#preparation/networks/meta.js';
import { prepareMintegralExport } from '#preparation/networks/mintegral.js';
import { prepareMolocoExport } from '#preparation/networks/moloco.js';
import { preparePreviewExport } from '#preparation/networks/preview.js';
import { prepareSnapchatExport } from '#preparation/networks/snapchat.js';
import { prepareUnityExport } from '#preparation/networks/unity.js';
import type { PreparedExportArtifact } from '#types/artifact.js';
import type { ExportProjectContext, ExportVariantContext } from '#types/context.js';
import type { ExportVariantResult } from '#types/export.js';

/** Prepares at most two artifacts at once, releasing each payload after its staged write. */
export async function prepareExportProject(
  project: ExportProjectContext,
  write: (artifact: PreparedExportArtifact) => Promise<void>,
): Promise<ExportVariantResult[]> {
  const results: ExportVariantResult[] = new Array(project.variants.length);
  let next = 0;
  let failure: { error: unknown } | undefined;

  async function worker(): Promise<void> {
    while (!failure) {
      const index = next++;
      const context = project.variants[index];
      if (!context) {
        return;
      }
      try {
        results[index] = await prepareAndWrite(context, write);
      } catch (error) {
        failure ??= { error };
      }
    }
  }

  // Workers catch preparation/write errors so all in-flight writes settle before
  // the caller can remove staging. Never schedule another variant after failure.
  await Promise.all(Array.from({ length: Math.min(2, project.variants.length) }, worker));
  if (failure) {
    throw failure.error;
  }
  return results;
}

/** Scope the payload to this call; only lightweight metadata escapes to the result list. */
async function prepareAndWrite(
  context: ExportVariantContext,
  write: (artifact: PreparedExportArtifact) => Promise<void>,
): Promise<ExportVariantResult> {
  const content = await prepareExportContent(context);
  const result = {
    file: context.outputFile,
    size: typeof content === 'string' ? Buffer.byteLength(content) : content.byteLength,
    variantId: context.variant.id,
  };
  await write({ content, outputFile: context.outputFile, variantId: context.variant.id });
  return result;
}

/** Applies the delivery rules owned by the resolved variant's network. */
function prepareExportContent(context: ExportVariantContext): Promise<string | Uint8Array> {
  switch (context.variant.network) {
    case 'adn':
    case 'applovin':
      return prepareAppLovinExport(context);
    case 'google':
      return prepareGoogleExport(context);
    case 'liftoff':
      return prepareLiftoffExport(context);
    case 'meta':
      return prepareMetaExport(context);
    case 'tiktok':
    case 'mintegral':
      return prepareMintegralExport(context);
    case 'moloco':
      return prepareMolocoExport(context);
    case 'preview':
      return preparePreviewExport(context);
    case 'snapchat':
      return prepareSnapchatExport(context);
    case 'unity':
      return prepareUnityExport(context);
    default:
      throw new Error(`Unsupported export network: ${String(context.variant.network)}.`);
  }
}
