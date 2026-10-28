import type { InlineConfig } from 'vite';

import { resolveBuildRuntimeModule } from '#runtime/resolve-build-runtime-module.js';
import {
  resolveDevtoolsStats,
  resolveWebglStats,
  resolveEndCardTrigger,
  resolveSoundControl,
} from '#runtime/resolve-devtools.js';
import { resolveRuntimeAnalytics } from '#runtime/resolve-runtime-analytics.js';
import { resolveRuntimeAudio } from '#runtime/resolve-runtime-audio.js';
import type { PlayableViteContext } from '#types/vite.js';

import { createGeneratedAssetsBoundaryPlugin } from './plugins/generated-assets-boundary.js';

/** Creates Vite configuration for authored application and runtime code only. */
export function createApplicationViteConfig(
  options: PlayableViteContext,
  assetsEntry: string,
  command: 'build' | 'serve',
): InlineConfig {
  const analytics = resolveRuntimeAnalytics(options.variant.analytics);

  return {
    define: options.profile.compileTimeDefinitions,
    plugins: [
      createGeneratedAssetsBoundaryPlugin({
        allowedImporter: assetsEntry,
        assetsModule: options.assetsModule,
      }),
    ],
    resolve: {
      alias: {
        '#adapter': resolveBuildRuntimeModule('bindings/adapter.mjs'),
        '#analytics': analytics.analytics,
        '#analytics-transport': analytics.transport,
        '#assets': resolveBuildRuntimeModule('bindings/assets.mjs'),
        '#audio': resolveRuntimeAudio(options.variant.audio),
        '#definition': resolveBuildRuntimeModule('bindings/definition.mjs'),
        '#stats': resolveDevtoolsStats(command, options.variant.devtools.stats),
        '#endcard-trigger': resolveEndCardTrigger(command, options.variant.devtools.endCardTrigger),
        '#sound-control': resolveSoundControl(
          command,
          options.variant.audio && options.variant.devtools.soundControl,
        ),
        '#webgl-stats': resolveWebglStats(command, options.variant.devtools.stats),
      },
    },
  };
}
