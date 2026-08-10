import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { validateStagedPackages } from './validate-staged-packages.mjs';

const publishOrder = [
  'darwin-arm64',
  'darwin-x64',
  'linux-arm64',
  'linux-x64',
  'main',
];

const npmTagForVersion = (version) =>
  /(alpha|beta|dev|rc)/.test(version) ? 'beta' : 'latest';

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status}`,
    );
  }

  return result;
};

const readPackage = (root, dir) =>
  JSON.parse(fs.readFileSync(path.join(root, dir, 'package.json'), 'utf8'));

const { root, version } = validateStagedPackages();
const tag = process.env.NPM_TAG || npmTagForVersion(version);

for (const dir of publishOrder) {
  const pkg = readPackage(root, dir);

  if (pkg.version !== version) {
    throw new Error(
      `Version mismatch for ${pkg.name}: ${pkg.version} != ${version}`,
    );
  }

  const view = run('npm', ['view', `${pkg.name}@${pkg.version}`, 'version'], {
    allowFailure: true,
    capture: true,
  });

  if (view.stdout.trim() === pkg.version) {
    console.log(`--> skipping ${pkg.name}@${pkg.version} (already published)`);
    continue;
  }

  console.log(`--> publishing ${pkg.name}@${pkg.version} (tag: ${tag})`);
  run('npm', [
    'publish',
    path.join(root, dir),
    '--access',
    'public',
    '--tag',
    tag,
  ]);
}
