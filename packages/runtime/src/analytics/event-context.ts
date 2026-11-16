const reservedProperties = new Set([
  'api_key',
  'distinct_id',
  'event',
  'properties',
  'timestamp',
  'audio_muted',
  'avg_fps',
  'cta_source',
  'build_id',
  'release_version',
  'elapsed_ms',
  'height',
  'integer_value',
  'language',
  'network',
  'orientation',
  'schema_version',
  'sequence',
  'session_id',
  'since_previous_ms',
  'version',
  'width',
]);

/** Snapshot custom strings without allowing overrides of transport or engine metadata. */
export function snapshotEventContext(
  properties: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(properties).filter(
        ([key, value]) =>
          /^[a-z][a-z0-9_]{0,79}$/u.test(key) &&
          !reservedProperties.has(key) &&
          typeof value === 'string',
      ),
    ),
  );
}
