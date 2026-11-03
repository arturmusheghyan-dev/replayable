/** Origin of a store request; independent of the playable's completion outcome. */
export type PlayableCtaSource =
  | 'persistent_cta'
  | 'cta_endcard'
  | 'banner'
  | 'teaser_tap'
  | 'gameplay_tap'
  | 'auto_redirect'
  | 'unknown';

export interface OpenStoreOptions {
  readonly source?: PlayableCtaSource;
}
