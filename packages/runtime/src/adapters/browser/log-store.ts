/** Restricted exports must not contain browser redirect code, even in fallback mode. */
export function logBrowserStore(): void {
  console.info(
    '[Replayable] Browser fallback CTA: store navigation requires the advertising host.',
  );
}
