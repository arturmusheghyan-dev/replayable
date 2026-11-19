import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { resolveCanonicalPath } from '#shared/canonical-path.js';
import { isMissingPathError } from '#shared/filesystem-error.js';
import type { ExportVariantResult } from '#types/export.js';

/**
 * Owns staging and replacement while the producer prepares and writes bounded work.
 * The producer must settle all writes before resolving or rejecting. Existing exports
 * remain untouched until it succeeds. Rollback preserves the old directory on awaited
 * replacement failures, and retains its backup if restoration also fails.
 * This is not a crash-safe transaction or a lock against concurrent exporters.
 */
export async function writeExportArtifacts(
  outputDirectory: string,
  prepare: (directory: string) => Promise<readonly ExportVariantResult[]>,
): Promise<readonly ExportVariantResult[]> {
  const parent = dirname(outputDirectory);
  // Resolution already checked this destination. Check again before creating
  // temporary files, in case an intermediate directory has become a symlink.
  await assertOutputDirectoryUnchanged(outputDirectory);
  await mkdir(parent, { recursive: true });
  // A unique sibling keeps temporary files out of the delivery directory and
  // ordinarily on the same filesystem, allowing directory renames rather than copies.
  const stagingDirectory = await mkdtemp(join(parent, '.replayable-exports-'));
  const preparedDirectory = join(stagingDirectory, 'prepared');
  const backupDirectory = join(stagingDirectory, 'previous');
  // This is a cleanup guard, not an indication that a previous export exists.
  // It becomes true only when rollback fails and the backup must remain recoverable.
  let preserveBackup = false;

  try {
    await mkdir(preparedDirectory);
    const results = await prepare(preparedDirectory);

    // Writing may take time. Recheck the destination before moving the old exports.
    await assertOutputDirectoryUnchanged(outputDirectory);
    const hasPreviousExport = await movePreviousExport(outputDirectory, backupDirectory);

    try {
      // All new files are complete. Publish the entire prepared directory at once.
      await rename(preparedDirectory, outputDirectory);
    } catch (error) {
      if (hasPreviousExport) {
        try {
          // Replacement failed after the old directory moved aside. Put it back
          // at the original path so the last successful exports remain usable.
          await rename(backupDirectory, outputDirectory);
        } catch (restoreError) {
          preserveBackup = true;
          // Both failures are preserved as members; neither replaces the other.
          // oxlint-disable-next-line preserve-caught-error
          throw new AggregateError(
            [error, restoreError],
            `Export replacement failed. Previous exports remain at ${backupDirectory}.`,
            { cause: restoreError },
          );
        }
      }
      // Successful rollback does not make this export successful. Report the
      // replacement error; on a first export, there was simply nothing to restore.
      throw error;
    }
    return results;
  } finally {
    if (!preserveBackup) {
      // Success: remove the obsolete backup. Write/replacement failure: remove
      // incomplete new files. After successful rollback, the old files are already
      // outside this directory again. Cleanup failures still reject the operation.
      await rm(stagingDirectory, { recursive: true, force: true });
    }
  }
}

/**
 * Moves an existing destination into the operation's backup directory.
 *
 * Returns true only after the move succeeds, allowing the caller to attempt rollback.
 * A missing path returns false (normally the first export). Permission, device, and
 * other filesystem errors propagate; they must not be treated as an absent export.
 */
async function movePreviousExport(
  outputDirectory: string,
  backupDirectory: string,
): Promise<boolean> {
  try {
    await rename(outputDirectory, backupDirectory);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }
}

/**
 * Detects a symlink introduced after resolution and before directory replacement.
 *
 * Resolution stores the canonical destination. Resolving it again immediately
 * before staging and replacement detects an intermediate path redirected since then.
 * Reject rather than move a directory belonging to that new target. This check
 * does not lock the path or prevent another process changing it after the check.
 */
async function assertOutputDirectoryUnchanged(outputDirectory: string): Promise<void> {
  const currentOutputDirectory = await resolveCanonicalPath(outputDirectory);

  if (currentOutputDirectory !== outputDirectory) {
    throw new Error(`Refusing to clean a redirected export directory: ${outputDirectory}.`);
  }
}
