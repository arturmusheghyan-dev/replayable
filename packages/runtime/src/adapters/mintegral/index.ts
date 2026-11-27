import {
  isDocumentVisible,
  readBrowserViewport,
  waitForDocumentReady,
} from '#adapters/browser/api.js';
import { subscribeToBrowserUpdates } from '#adapters/browser/events.js';
import { openBrowserStore } from '#adapters/browser/open-store.js';
import { withBrowserFallback } from '#adapters/browser/with-fallback.js';
import { FULL_VOLUME } from '#lifecycle/volume.js';
import type { HostAdapter, HostSnapshot } from '#types/host-adapter.js';
import type { MintegralWindow } from '#types/host-apis.js';

/**
 * Creates the host adapter used by Mintegral playable ads.
 *
 * Replayable calls install, gameReady, and gameEnd. Mintegral calls the
 * gameStart and gameClose functions installed here, allowing its host lifecycle
 * to control visibility, frame scheduling, timers, and audio through one signal.
 */
export function createAdapter(): HostAdapter {
  const host = window as MintegralWindow;

  const native: HostAdapter = {
    async initialize(listener): Promise<HostSnapshot> {
      await waitForDocumentReady();

      let documentVisible = isDocumentVisible();
      let gameStarted = false;

      const publishVisibility = (): void => {
        listener({
          type: 'visibilitychange',
          visible: documentVisible && gameStarted,
        });
      };

      host.gameStart = (): void => {
        gameStarted = true;
        publishVisibility();
      };
      host.gameClose = (): void => {
        gameStarted = false;
        publishVisibility();
      };

      subscribeToBrowserUpdates((update) => {
        if (update.type === 'visibilitychange') {
          documentVisible = update.visible;
          publishVisibility();
          return;
        }

        listener(update);
      });

      return {
        visible: false,
        volume: FULL_VOLUME,
        viewport: readBrowserViewport(),
      };
    },

    notifyComplete(): void {
      host.gameEnd?.();
    },

    notifyReady(): void {
      host.gameReady?.();
    },

    openStore(): void {
      host.install?.();
    },
  };
  return withBrowserFallback(
    native,
    () =>
      host.gameReady !== undefined ||
      host.install !== undefined ||
      host.gameEnd !== undefined ||
      host.gameStart !== undefined ||
      host.gameClose !== undefined,
    openBrowserStore,
  );
}
