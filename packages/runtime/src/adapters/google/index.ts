import { openBrowserStore } from '#adapters/browser/open-store.js';
import { withBrowserFallback } from '#adapters/browser/with-fallback.js';
import type { HostAdapter } from '#types/host-adapter.js';

import { createBrowserAdapter } from '../browser/create-adapter.js';

/** API injected by Google Ads through its network-owned Exit API script. */
declare const ExitApi: {
  exit(): void;
};

/**
 * Creates the host adapter used by Google App Campaign playable ads.
 *
 * Google playables use ordinary browser lifecycle signals, while `ExitApi`
 * records the CTA and opens the campaign-owned destination.
 */
export function createAdapter(): HostAdapter {
  const native = createBrowserAdapter(() => {
    ExitApi.exit();
  });
  return withBrowserFallback(native, () => typeof ExitApi !== 'undefined', openBrowserStore);
}
