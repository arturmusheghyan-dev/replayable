import type { ReplayableNetwork } from './config.js';

/** Raw project and variant values supplied to an export filename callback. */
export interface ExportFilenameContext {
  readonly name: string;
  readonly version: string;
  /** Stable delivery identity, unaffected by export naming. */
  readonly network: ReplayableNetwork;
  /** Configured network exportName, falling back to its stable network ID. */
  readonly exportName: string;
  readonly language: string;
}

/** Returns a filename without a directory or extension. Casing and spacing are preserved. */
export type ExportFilename = (context: ExportFilenameContext) => string;
