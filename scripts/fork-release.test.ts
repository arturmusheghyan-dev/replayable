import assert from 'node:assert/strict';
import { test } from 'node:test';

import { prepareManifest, tag, version } from './fork-release.ts';

const packages = {
  '@replayablejs/runtime': {
    filename: 'runtime.tgz',
    url: 'https://github.com/example/runtime.tgz',
  },
  '@replayablejs/config': { filename: 'config.tgz', url: 'https://github.com/example/config.tgz' },
};
test('fork manifests preserve source and pin internal dependencies to one release', () => {
  const source = {
    name: '@replayablejs/runtime',
    version: '0.1.0-alpha.12',
    scripts: { prepublishOnly: 'npm publish' },
    publishConfig: { access: 'public' },
    devDependencies: { typescript: '7.0.2' },
    dependencies: { '@replayablejs/config': '0.1.0-alpha.12', three: '0.186.0' },
    peerDependencies: { '@replayablejs/config': '^0.1.0' },
  };
  const before = structuredClone(source);
  const packed = prepareManifest(source, packages, 'abc');
  assert.deepEqual(source, before);
  assert.equal(packed.version, version);
  assert.equal(packed.private, true);
  assert.equal(packed.dependencies?.['@replayablejs/config'], packages['@replayablejs/config'].url);
  assert.equal(packed.dependencies?.three, '0.186.0');
  assert.equal(packed.peerDependencies?.['@replayablejs/config'], version);
  assert.equal(packed.scripts, undefined);
  assert.equal(packed.publishConfig, undefined);
  assert.equal(packed.gitHead, 'abc');
});
test('fork packaging refuses missing internal modules and unresolved local dependencies', () => {
  const source = { name: '@replayablejs/runtime', version: '0.1.0-alpha.12' };
  assert.throws(
    () =>
      prepareManifest(
        { ...source, dependencies: { '@replayablejs/missing': '1.0.0' } },
        packages,
        'abc',
      ),
    /Missing fork dependency/,
  );
  assert.throws(
    () =>
      prepareManifest(
        { ...source, optionalDependencies: { local: 'file:./private.tgz' } },
        packages,
        'abc',
      ),
    /Unresolved development dependency/,
  );
});

test('combined release keeps a single fork package version', () => {
  assert.equal(tag, 'studio-preview.5');
  assert.equal(version, '0.1.0-studio-preview.5');
});
