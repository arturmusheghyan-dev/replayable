/** Used only by networks whose export policy permits a browser store redirect. */
export function openBrowserStore(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
