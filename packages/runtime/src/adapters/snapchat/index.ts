import type { HostAdapter } from '#types/host-adapter.js';

import { createBrowserAdapter } from '../browser/create-adapter.js';

/** Snapchat injects the campaign-owned store API into the playable WebView. */
declare const ScPlayableAd: { onCTAClick(): void } | undefined;

/** Browser lifecycle with Snapchat's required, user-triggered store action. */
export function createAdapter(): HostAdapter {
  return createBrowserAdapter(() => {
    if (typeof ScPlayableAd === 'undefined' || typeof ScPlayableAd?.onCTAClick !== 'function') {
      throw new Error('Snapchat requires window.ScPlayableAd.onCTAClick.');
    }
    ScPlayableAd.onCTAClick();
  });
}
