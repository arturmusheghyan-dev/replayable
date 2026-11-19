import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { prepareExportProject } from '#preparation/prepare-export-project.js';
import type { ExportProjectContext } from '#types/context.js';
import type { ExportProjectResult } from '#types/export.js';

import { writeExportArtifacts } from './write-export-artifacts.js';

/** Stages bounded preparation, then reports only successfully installed destinations. */
export async function emitExportProject(
  project: ExportProjectContext,
): Promise<ExportProjectResult> {
  const variants = await writeExportArtifacts(project.outputDirectory, (directory) =>
    prepareExportProject(project, async (artifact) => {
      // Resolution has already validated unique flat filenames.
      await writeFile(join(directory, basename(artifact.outputFile)), artifact.content);
    }),
  );
  return { outputDirectory: project.outputDirectory, variants };
}
