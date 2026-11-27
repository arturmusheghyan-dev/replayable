import type { HostAdapter, HostSnapshot, HostUpdateListener } from '#types/host-adapter.js';

import { waitForDocumentReady } from './api.js';
import { createBrowserAdapter } from './create-adapter.js';

/** Selects once after document bootstrap; a present SDK always owns its lifecycle. */
export function withBrowserFallback(
  native: HostAdapter,
  hasHost: () => boolean,
  openBrowserStore: HostAdapter['openStore'],
): HostAdapter {
  let active = native;
  let initialization: Promise<HostSnapshot> | undefined;

  async function initialize(listener: HostUpdateListener): Promise<HostSnapshot> {
    await waitForDocumentReady();
    if (hasHost()) {
      // Do not turn an SDK error, loading state, or hidden ad into a browser preview.
      return native.initialize(listener);
    }

    active = createBrowserAdapter(openBrowserStore);
    const snapshot = await active.initialize(listener);
    console.info(
      '[Replayable] Browser fallback: no advertising host; analytics delivery disabled.',
    );
    return { ...snapshot, browserFallback: true };
  }

  return {
    initialize(listener) {
      initialization ??= initialize(listener);
      return initialization;
    },
    notifyComplete() {
      active.notifyComplete?.();
    },
    notifyReady() {
      active.notifyReady?.();
    },
    openStore(url) {
      active.openStore(url);
    },
  };
}
