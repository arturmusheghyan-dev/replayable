import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { invokePackageManager } from './pnpm-utils.ts';

export const repository = 'arturmusheghyan-dev/replayable';
export const tag = 'studio-preview.4';
export const version = '0.1.0-studio-preview.4';
type Dependencies = Record<string, string>;
interface PackageManifest {
  name: string;
  version: string;
  private?: boolean;
  dependencies?: Dependencies;
  optionalDependencies?: Dependencies;
  peerDependencies?: Dependencies;
  devDependencies?: Dependencies;
  scripts?: Record<string, string>;
  publishConfig?: unknown;
  [key: string]: unknown;
}
export interface ReleasePackage {
  filename: string;
  url: string;
}

/** Only staged manifests change; source versions and original archives remain intact. */
export function prepareManifest(
  original: PackageManifest,
  packages: Record<string, ReleasePackage>,
  commit: string,
): PackageManifest {
  const manifest = structuredClone(original);
  assert(packages[manifest.name], `Missing fork package: ${manifest.name}`);
  manifest.version = version;
  manifest.private = true;
  manifest.gitHead = commit;
  manifest.repository = {
    type: 'git',
    url: `git+https://github.com/${repository}.git`,
    directory: `packages/${manifest.name.split('/')[1]}`,
  };
  manifest.homepage = `https://github.com/${repository}/releases/tag/${tag}`;
  manifest.bugs = { url: `https://github.com/${repository}/issues` };
  manifest.replayablePreview = {
    repository,
    branch: 'main',
    commit,
    tag,
    sourceVersion: original.version,
  };
  delete manifest.devDependencies;
  delete manifest.scripts;
  delete manifest.publishConfig;
  for (const section of ['dependencies', 'optionalDependencies'] as const) {
    for (const name of Object.keys(manifest[section] ?? {})) {
      if (name.startsWith('@replayablejs/')) {
        assert(packages[name], `Missing fork dependency: ${name}`);
        manifest[section]![name] = packages[name].url;
      }
    }
  }
  for (const name of Object.keys(manifest.peerDependencies ?? {})) {
    if (name.startsWith('@replayablejs/')) {
      assert(packages[name], `Missing fork peer: ${name}`);
      manifest.peerDependencies![name] = version;
    }
  }
  assert(
    !/"(?:workspace:|catalog:|file:|link:)/u.test(JSON.stringify(manifest)),
    'Unresolved development dependency',
  );
  return manifest;
}

function packageRelease(outputArgument: string | undefined): void {
  assert(outputArgument, 'Usage: pnpm fork:pack <new-output-directory>');
  const source = fileURLToPath(new URL('../', import.meta.url));
  const output = resolve(outputArgument);
  const pnpmPath = process.env.npm_execpath;
  assert(pnpmPath, 'Run through pnpm fork:pack');
  assert(!existsSync(output), 'Use a new output directory; never replace release artifacts.');
  const run = (command: string, args: string[], cwd = source) =>
    execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, HUSKY: '0', COPYFILE_DISABLE: '1' },
    }).trim();
  assert.equal(
    run('git', ['branch', '--show-current']),
    'main',
    'Fork releases must come from main',
  );
  assert.equal(
    run('git', ['status', '--porcelain', '--untracked-files=all']),
    '',
    'Commit and review the source before packaging',
  );
  const commit = run('git', ['rev-parse', 'HEAD']);
  assert.equal(
    run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`]),
    '',
    'Release tag already exists remotely',
  );
  assert.equal(
    invokePackageManager(pnpmPath, ['--version'], { cwd: source, encoding: 'utf8' }).trim(),
    '10.32.1',
  );
  const sourcePackages = readdirSync(join(source, 'packages'))
    .sort()
    .flatMap((folder) => {
      const directory = join(source, 'packages', folder);
      const manifest: PackageManifest = JSON.parse(
        readFileSync(join(directory, 'package.json'), 'utf8'),
      );
      return manifest.private ? [] : [{ directory, manifest }];
    });
  assert.equal(
    new Set(sourcePackages.map(({ manifest }) => manifest.version)).size,
    1,
    'Source package versions must match',
  );
  const packages: Record<string, ReleasePackage> = Object.fromEntries(
    sourcePackages.map(({ manifest }) => {
      const filename = `${manifest.name.replace('@', '').replace('/', '-')}-${version}.tgz`;
      return [
        manifest.name,
        { filename, url: `https://github.com/${repository}/releases/download/${tag}/${filename}` },
      ];
    }),
  );
  mkdirSync(output, { recursive: true });
  const staging = mkdtempSync(join(output, '.staging-'));
  const records: Record<string, unknown> = {};
  for (const { directory, manifest: original } of sourcePackages) {
    assert(existsSync(join(directory, 'dist')), `Build ${original.name} first`);
    invokePackageManager(pnpmPath, ['pack', '--pack-destination', staging], {
      cwd: directory,
      stdio: 'pipe',
    });
    const archiveName = `${original.name.replace('@', '').replace('/', '-')}-${original.version}.tgz`;
    const unpacked = join(staging, basename(directory));
    mkdirSync(unpacked);
    run('tar', ['-xzf', join(staging, archiveName), '-C', unpacked]);
    const packageDirectory = join(unpacked, 'package');
    const packed: PackageManifest = JSON.parse(
      readFileSync(join(packageDirectory, 'package.json'), 'utf8'),
    );
    const manifest = prepareManifest(packed, packages, commit);
    writeFileSync(join(packageDirectory, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    if (!readdirSync(packageDirectory).some((name) => /^licen[cs]e(?:\.|$)/iu.test(name))) {
      cpSync(join(source, 'LICENSE'), join(packageDirectory, 'LICENSE'));
    }
    const item = packages[original.name]!;
    const target = join(output, item.filename);
    run('tar', ['-czf', target, '-C', unpacked, 'package']);
    const bytes = readFileSync(target);
    records[original.name] = {
      ...item,
      version,
      sourceVersion: original.version,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
      dependencies: manifest.dependencies ?? {},
      peerDependencies: manifest.peerDependencies ?? {},
    };
    console.log(`Packed ${original.name}`);
  }
  const metadata = {
    schemaVersion: 1,
    repository,
    branch: 'main',
    commit,
    tag,
    version,
    node: process.version,
    pnpm: '10.32.1',
    packages: records,
  };
  writeFileSync(join(output, 'preview-manifest.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  for (const name of ['fork-release.ts', 'pnpm-utils.ts']) {
    cpSync(join(source, 'scripts', name), join(output, name));
  }
  const artifacts = [
    ...Object.values(packages).map(({ filename }) => filename),
    'preview-manifest.json',
    'fork-release.ts',
    'pnpm-utils.ts',
  ].sort();
  writeFileSync(
    join(output, 'SHA256SUMS'),
    artifacts
      .map(
        (name) =>
          `${createHash('sha256')
            .update(readFileSync(join(output, name)))
            .digest('hex')}  ${name}`,
      )
      .join('\n') + '\n',
  );
  rmSync(staging, { recursive: true });
  console.log(
    `Packaged ${sourcePackages.length} modules from ${commit}. No publication performed.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  packageRelease(process.argv[2]);
}
