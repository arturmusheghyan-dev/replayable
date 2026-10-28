import type { PlayableVariant, ReplayableNetwork } from '@replayablejs/config';

import type { NetworkHtmlHead, NetworkProfile, PlayableProfile } from '#types/network.js';

import { resolveGoogleHtmlHead } from './google.js';
import { resolveUnityHtmlHead } from './unity.js';

const fullScreenEndCard = { animation: 'continuous', interaction: 'full-screen' } as const;
const ctaOnlyEndCard = { animation: 'finite', interaction: 'cta-only' } as const;
const previewControls = { persistentCta: true } as const;
const hiddenControls = { persistentCta: false } as const;
const liftoffControls = { persistentCta: true } as const;
const noCompileTimeDefinitions: Readonly<Record<string, string>> = {};

const emptyHtmlHead: NetworkHtmlHead = {
  metaTags: [],
  scripts: [],
};

const applovinProfile: NetworkProfile = {
  assetMode: 'inline',
  applicationMode: 'single-module',
  compileTimeDefinitions: noCompileTimeDefinitions,
  completionDurationStart: 'interaction',
  controls: hiddenControls,
  endCard: fullScreenEndCard,
  loadingIndicator: 'replayable',
  resolveHtmlHead: resolveEmptyHtmlHead,
  runtime: 'applovin',
};

const mintegralProfile: NetworkProfile = {
  assetMode: 'inline',
  applicationMode: 'single-module',
  compileTimeDefinitions: noCompileTimeDefinitions,
  completionDurationStart: 'ready',
  controls: hiddenControls,
  endCard: fullScreenEndCard,
  loadingIndicator: 'host',
  resolveHtmlHead: resolveEmptyHtmlHead,
  runtime: 'mintegral',
};

const networkProfiles = {
  preview: {
    assetMode: 'inline',
    applicationMode: 'single-module',
    compileTimeDefinitions: noCompileTimeDefinitions,
    completionDurationStart: 'ready',
    controls: previewControls,
    endCard: fullScreenEndCard,
    loadingIndicator: 'replayable',
    resolveHtmlHead: resolveEmptyHtmlHead,
    runtime: 'browser',
  },
  applovin: applovinProfile,
  adn: applovinProfile,
  meta: {
    assetMode: 'inline',
    applicationMode: 'single-module',
    compileTimeDefinitions: noCompileTimeDefinitions,
    completionDurationStart: 'ready',
    controls: hiddenControls,
    endCard: fullScreenEndCard,
    loadingIndicator: 'replayable',
    resolveHtmlHead: resolveEmptyHtmlHead,
    runtime: 'meta',
  },
  google: {
    // Keep binary assets inside JavaScript so the ZIP contains only web code files.
    assetMode: 'inline',
    applicationMode: 'module-graph',
    compileTimeDefinitions: noCompileTimeDefinitions,
    completionDurationStart: 'ready',
    controls: hiddenControls,
    endCard: ctaOnlyEndCard,
    loadingIndicator: 'replayable',
    resolveHtmlHead: resolveGoogleHtmlHead,
    runtime: 'google',
  },
  liftoff: {
    assetMode: 'resource',
    applicationMode: 'module-graph',
    compileTimeDefinitions: noCompileTimeDefinitions,
    completionDurationStart: 'ready',
    controls: liftoffControls,
    endCard: fullScreenEndCard,
    loadingIndicator: 'replayable',
    resolveHtmlHead: resolveEmptyHtmlHead,
    runtime: 'liftoff',
  },
  mintegral: mintegralProfile,
  tiktok: mintegralProfile,
  snapchat: {
    assetMode: 'inline',
    applicationMode: 'single-module',
    compileTimeDefinitions: noCompileTimeDefinitions,
    completionDurationStart: 'ready',
    controls: hiddenControls,
    endCard: ctaOnlyEndCard,
    loadingIndicator: 'replayable',
    resolveHtmlHead: resolveEmptyHtmlHead,
    runtime: 'snapchat',
  },
  moloco: {
    assetMode: 'inline',
    applicationMode: 'single-module',
    compileTimeDefinitions: {
      // Moloco forbids this global. Howler only needs it for URL sources, while
      // Moloco's inline asset mode always supplies audio as a data URI.
      XMLHttpRequest: 'undefined',
    },
    completionDurationStart: 'ready',
    controls: hiddenControls,
    endCard: fullScreenEndCard,
    loadingIndicator: 'replayable',
    resolveHtmlHead: resolveEmptyHtmlHead,
    runtime: 'moloco',
  },
  unity: {
    assetMode: 'inline',
    applicationMode: 'single-module',
    compileTimeDefinitions: noCompileTimeDefinitions,
    completionDurationStart: 'ready',
    controls: hiddenControls,
    endCard: fullScreenEndCard,
    loadingIndicator: 'replayable',
    resolveHtmlHead: resolveUnityHtmlHead,
    runtime: 'unity',
  },
} satisfies Record<ReplayableNetwork, NetworkProfile>;

/** Resolves the asset, document, and runtime policy owned by one variant's network. */
export function resolvePlayableProfile(variant: PlayableVariant): PlayableProfile {
  const profile = networkProfiles[variant.network];
  if (variant.network === 'snapchat') {
    if (!variant.screen.orientations.portrait.enabled) {
      throw new Error('Snapchat requires an enabled portrait layout.');
    }
    if (variant.analytics !== false && variant.analytics.destination !== false) {
      throw new Error('Snapchat does not support outbound analytics. Disable its analytics route.');
    }
  }

  return {
    assetMode: profile.assetMode,
    applicationMode: profile.applicationMode,
    compileTimeDefinitions: profile.compileTimeDefinitions,
    completionDurationStart: profile.completionDurationStart,
    // Development always selects preview. Real ad networks replace authored
    // preferences completely, rather than treating them as optional overrides.
    controls: variant.network === 'preview' ? variant.controls : profile.controls,
    endCard: profile.endCard,
    htmlHead: profile.resolveHtmlHead(variant),
    loadingIndicator: profile.loadingIndicator,
    runtime: profile.runtime,
    screen:
      variant.network === 'snapchat'
        ? {
            ...variant.screen,
            orientations: {
              ...variant.screen.orientations,
              landscape: { ...variant.screen.orientations.landscape, enabled: false },
            },
          }
        : variant.screen,
  };
}

/** Returns no document additions for networks without production head requirements. */
function resolveEmptyHtmlHead(_variant: PlayableVariant): NetworkHtmlHead {
  return emptyHtmlHead;
}
