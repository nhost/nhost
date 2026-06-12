#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const REPO = 'nhost/nhost';

// key = npm package suffix (Node's process.platform/arch);
// asset = suffix used by the cli@VERSION release tarballs (Go's GOOS/GOARCH).
const PLATFORMS = [
  { key: 'darwin-arm64', asset: 'darwin-arm64' },
  { key: 'darwin-x64', asset: 'darwin-amd64' },
  { key: 'linux-arm64', asset: 'linux-arm64' },
  { key: 'linux-x64', asset: 'linux-amd64' },
];

const npmRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function log(message) {
  console.error(`--> ${message}`);
}

function fail(message) {
  console.error(`FAILED: ${message}`);
  process.exit(1);
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      version: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      pack: { type: 'boolean', default: false },
    },
  });
  if (!values.version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(values.version)) {
    fail(
      'usage: node scripts/publish.mjs --version X.Y.Z [--dry-run | --pack]',
    );
  }
  return {
    version: values.version,
    dryRun: values['dry-run'],
    packOnly: values.pack,
  };
}

function downloadAssets(version, workDir) {
  log(`downloading cli@${version} assets from ${REPO}`);
  try {
    execFileSync(
      'gh',
      [
        'release',
        'download',
        `cli@${version}`,
        '--repo',
        REPO,
        '--pattern',
        'cli-*.tar.gz',
        '--pattern',
        'checksums.txt',
        '--dir',
        workDir,
      ],
      { stdio: 'inherit' },
    );
  } catch {
    fail(
      `could not download release cli@${version} — is gh installed and authenticated, and does the release exist?`,
    );
  }
}

function verifyChecksums(workDir, files) {
  const sums = new Map(
    fs
      .readFileSync(path.join(workDir, 'checksums.txt'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, file] = line.trim().split(/\s+/);
        return [path.basename(file), hash];
      }),
  );
  for (const file of files) {
    const expected = sums.get(file);
    if (!expected) {
      fail(`no checksum for ${file} in checksums.txt`);
    }
    const actual = createHash('sha256')
      .update(fs.readFileSync(path.join(workDir, file)))
      .digest('hex');
    if (actual !== expected) {
      fail(`checksum mismatch for ${file}`);
    }
  }
  log(`verified ${files.length} checksums`);
}

function stagePlatform(version, workDir, distDir, platform) {
  const pkgDir = path.join(distDir, platform.key);
  fs.mkdirSync(pkgDir, { recursive: true });

  const pkg = readJSON(
    path.join(npmRoot, 'platforms', platform.key, 'package.json'),
  );
  pkg.version = version;
  writeJSON(path.join(pkgDir, 'package.json'), pkg);

  const extractDir = path.join(workDir, `extract-${platform.key}`);
  fs.mkdirSync(extractDir);
  execFileSync('tar', [
    '-xzf',
    path.join(workDir, `cli-${version}-${platform.asset}.tar.gz`),
    '-C',
    extractDir,
  ]);
  fs.copyFileSync(path.join(extractDir, 'cli'), path.join(pkgDir, 'nhost'));
  fs.chmodSync(path.join(pkgDir, 'nhost'), 0o755);

  return { name: pkg.name, dir: pkgDir };
}

function stageMain(version, distDir, platformNames) {
  const pkgDir = path.join(distDir, 'main');
  fs.mkdirSync(path.join(pkgDir, 'bin'), { recursive: true });

  const pkg = readJSON(path.join(npmRoot, 'package.json'));
  pkg.version = version;

  const declared = Object.keys(pkg.optionalDependencies).sort();
  const staged = [...platformNames].sort();
  if (JSON.stringify(declared) !== JSON.stringify(staged)) {
    fail(
      `optionalDependencies (${declared.join(', ')}) do not match platform packages (${staged.join(', ')})`,
    );
  }
  for (const name of declared) {
    pkg.optionalDependencies[name] = version;
  }
  writeJSON(path.join(pkgDir, 'package.json'), pkg);

  const shim = fs.readFileSync(path.join(npmRoot, 'bin', 'nhost'), 'utf8');
  const prefix = shim.match(/const PKG_PREFIX = '([^']+)'/)?.[1];
  if (prefix !== pkg.name) {
    fail(
      `bin/nhost PKG_PREFIX (${prefix}) does not match package name (${pkg.name})`,
    );
  }
  fs.copyFileSync(
    path.join(npmRoot, 'bin', 'nhost'),
    path.join(pkgDir, 'bin', 'nhost'),
  );
  fs.chmodSync(path.join(pkgDir, 'bin', 'nhost'), 0o755);
  fs.copyFileSync(
    path.join(npmRoot, 'README.md'),
    path.join(pkgDir, 'README.md'),
  );

  return { name: pkg.name, dir: pkgDir };
}

function smokeTest(version, distDir) {
  const hostKey = `${process.platform}-${process.arch}`;
  if (!PLATFORMS.some((platform) => platform.key === hostKey)) {
    log(`skipping binary smoke test (unsupported host ${hostKey})`);
    return;
  }
  const bin = path.join(distDir, hostKey, 'nhost');
  const out = execFileSync(bin, ['--version'], { encoding: 'utf8' });
  if (!out.includes(version)) {
    fail(`staged binary reports "${out.trim()}", expected ${version}`);
  }
  log(`staged binary ok: ${out.trim()}`);
}

function alreadyPublished(name, version) {
  const result = spawnSync('npm', ['view', `${name}@${version}`, 'version'], {
    encoding: 'utf8',
  });
  return result.status === 0 && result.stdout.trim() === version;
}

function publish(pkg, version, dryRun) {
  // The registry rejects republishing an existing version, so skip live
  // packages — re-running after a partial failure (CI retry or manual run)
  // then publishes only what is missing instead of dying on the conflict.
  if (!dryRun && alreadyPublished(pkg.name, version)) {
    log(`skipping ${pkg.name}@${version} — already on the registry`);
    return;
  }
  // npm publish always applies `latest` unless --tag is given; it does not
  // infer a tag from the semver prerelease component. Publish prereleases
  // under `beta` (the channel wf_release_npm.yaml uses for the other @nhost
  // packages) so they don't move `latest` for stable-channel installs.
  const tag = version.includes('-') ? 'beta' : 'latest';
  log(
    `${dryRun ? 'dry-run publish' : 'publishing'} ${pkg.name}@${version} (tag: ${tag})`,
  );
  const args = ['publish', '--access', 'public', '--tag', tag];
  if (dryRun) {
    args.push('--dry-run');
  }
  const result = spawnSync('npm', args, { cwd: pkg.dir, stdio: 'inherit' });
  if (result.status !== 0) {
    fail(`npm publish failed for ${pkg.name}`);
  }
}

// npm pack (not pnpm pack) so file modes survive — pnpm pack strips the
// binary's executable bit, which would break installs with EACCES.
function pack(pkg) {
  log(`packing ${pkg.name}`);
  const result = spawnSync('npm', ['pack'], { cwd: pkg.dir, stdio: 'inherit' });
  if (result.status !== 0) {
    fail(`npm pack failed for ${pkg.name}`);
  }
}

const { version, dryRun, packOnly } = parseCliArgs();
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nhost-npm-'));
const distDir = path.join(npmRoot, 'dist');
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir);

downloadAssets(version, workDir);
verifyChecksums(
  workDir,
  PLATFORMS.map((platform) => `cli-${version}-${platform.asset}.tar.gz`),
);

const platformPkgs = PLATFORMS.map((platform) =>
  stagePlatform(version, workDir, distDir, platform),
);
const mainPkg = stageMain(
  version,
  distDir,
  platformPkgs.map((pkg) => pkg.name),
);
smokeTest(version, distDir);

// Platform packages must be live before the main package: a published main
// with missing platform packages breaks installs.
for (const pkg of [...platformPkgs, mainPkg]) {
  if (packOnly) {
    pack(pkg);
  } else {
    publish(pkg, version, dryRun);
  }
}

fs.rmSync(workDir, { recursive: true, force: true });
log(
  packOnly
    ? 'packed — tarballs in cli/npm/dist/*/'
    : dryRun
      ? 'dry run complete — staged packages left in cli/npm/dist/'
      : `published ${platformPkgs.length + 1} packages at ${version}`,
);
