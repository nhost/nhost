const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const SCRIPT = join(__dirname, '..', 'nhost-install-deps.sh');

// The shared install library is byte-identical to nhost/be's copy at
// services/cd/cmd/installscript/nhost-install-deps.sh, where the same hash is
// pinned. On an intentional edit: update this hash AND copy the file to the
// other repo so the two stay in sync.
const WANT_CHECKSUM =
  'af0249aa36d6b8a67d3bdc85f15ce684c54594df5b3cc679f4871da233f919b8';

describe('shared install library (parity with nhost/be services/cd)', () => {
  test('checksum is in sync with nhost/be', () => {
    const buf = readFileSync(SCRIPT);
    expect(createHash('sha256').update(buf).digest('hex')).toBe(WANT_CHECKSUM);
  });

  test('runs a frozen, workspace-isolated install for each manager', () => {
    const script = readFileSync(SCRIPT, 'utf8');

    expect(script.match(/npm ci --/)).not.toBeNull();
    expect(script).toMatch(/npm ci .*--ignore-scripts/);
    expect(script).toMatch(/pnpm install .*--ignore-scripts/);
    expect(script).toMatch(
      /corepack "yarn@\$NHOST_YARN_CLASSIC_SPEC" install .*--frozen-lockfile.*--ignore-scripts/,
    );
  });

  test('rejects Yarn Berry before bootstrapping corepack', () => {
    const script = readFileSync(SCRIPT, 'utf8');
    const guardIndex = script.indexOf('Yarn Berry is not supported');
    const corepackIndex = script.indexOf(
      '\tcorepack enable --install-directory',
    );

    expect(guardIndex).not.toBe(-1);
    expect(corepackIndex).not.toBe(-1);
    expect(guardIndex).toBeLessThan(corepackIndex);
    expect(script).toContain(
      '(detected via packageManager or devEngines.packageManager)',
    );
    expect(script).toContain('(detected via yarn.lock)');
    expect(script).toContain('Yarn 0 is not supported');
  });

  // Runs nhost_install_deps against a throwaway project, stubbing out the
  // package managers so nothing is fetched. Returns the pinned-Classic argv the
  // yarn branch would have executed, plus stderr and the exit status.
  function runInstaller(files) {
    const root = mkdtempSync(join(tmpdir(), 'nhost-yarn-'));
    try {
      const workDir = join(root, 'functions');
      mkdirSync(workDir);
      for (const [name, contents] of Object.entries(files)) {
        writeFileSync(join(workDir, name), contents);
      }

      const opts = {
        cwd: workDir,
        env: { ...process.env, HOME: root, WORK_DIR: workDir },
        encoding: 'utf8',
      };
      const argv = [
        '-c',
        `
        . "$1"
        mkdir() { :; }
        corepack() {
          [ "$1" = enable ] && return 0
          printf '%s\\n' "$@" "$YARN_IGNORE_PATH"
        }
        nhost_install_deps
      `,
        'installer-test',
        SCRIPT,
      ];

      try {
        return {
          status: 0,
          stdout: execFileSync('sh', argv, opts),
          stderr: '',
        };
      } catch (error) {
        return {
          status: error.status,
          stdout: error.stdout ?? '',
          stderr: error.stderr ?? '',
        };
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  const PINNED_CLASSIC_ARGV = [
    'yarn@1.22.22+sha1.ac34549e6aa8e7ead463a7407e1c7390f61a6610',
    'install',
    '--frozen-lockfile',
    '--ignore-scripts',
    '1',
  ];

  test('a yarn.lock project installs through the pinned Yarn Classic spec', () => {
    // The pin plus YARN_IGNORE_PATH is what stops any manifest in the tree --
    // including a Berry-selecting parent -- from getting corepack to pick Berry.
    const { status, stdout } = runInstaller({
      'package.json': '{"name":"fn"}',
      'yarn.lock': '# yarn lockfile v1\n',
    });

    expect(status).toBe(0);
    expect(stdout.trim().split('\n')).toEqual(PINNED_CLASSIC_ARGV);
  });

  test.each([
    ['object', '{"name":"yarn","version":"4.9.1"}'],
    ['array', '[{"name":"yarn","version":"4.9.1"}]'],
  ])(
    'rejects Berry from devEngines.packageManager (%s form)',
    (_form, decl) => {
      const { status, stderr } = runInstaller({
        'package.json': `{"name":"fn","devEngines":{"packageManager":${decl}}}`,
        'yarn.lock': '# yarn lockfile v1\n',
      });

      expect(status).not.toBe(0);
      expect(stderr).toMatch(/Yarn Berry is not supported/);
    },
  );

  // devEngines.packageManager.version is a semver range by spec, so a ranged
  // Classic pin must not be mistaken for Berry.
  test.each(['^1.22.19', '>=1.22.0', '1.x'])(
    'installs a Classic project pinned by a devEngines range (%s)',
    (version) => {
      const { status, stdout, stderr } = runInstaller({
        'package.json': `{"name":"fn","devEngines":{"packageManager":{"name":"yarn","version":"${version}"}}}`,
        'yarn.lock': '# yarn lockfile v1\n',
      });

      expect(stderr).not.toMatch(/Yarn Berry is not supported/);
      expect(status).toBe(0);
      expect(stdout.trim().split('\n')).toEqual(PINNED_CLASSIC_ARGV);
    },
  );

  // npm strips a BOM and installs, so the manifest probe must not reject one.
  test('tolerates a BOM-prefixed package.json', () => {
    const { status, stdout, stderr } = runInstaller({
      'package.json': '\uFEFF{"name":"fn"}',
      'yarn.lock': '# yarn lockfile v1\n',
    });

    expect(stderr).not.toMatch(/refusing to guess/);
    expect(status).toBe(0);
    expect(stdout.trim().split('\n')).toEqual(PINNED_CLASSIC_ARGV);
  });

  // A Berry lockfile is unusable by the Classic pin whatever the manifest
  // declares, so the clear error must win over a third-party lockfile error.
  test('rejects a Berry yarn.lock despite a Classic packageManager', () => {
    const { status, stderr } = runInstaller({
      'package.json': '{"name":"fn","packageManager":"yarn@1.22.22"}',
      'yarn.lock': '__metadata:\n  version: 8\n',
    });

    expect(status).not.toBe(0);
    expect(stderr).toMatch(/detected via yarn\.lock/);
  });

  // pnpm bakes a pnpmfileChecksum into the lockfile when the project ships a
  // .pnpmfile.cjs, then refuses a frozen install once hooks are disabled.
  test('rejects a pnpm project whose lockfile pins hook config', () => {
    const { status, stderr } = runInstaller({
      'package.json': '{"name":"fn"}',
      'pnpm-lock.yaml':
        "lockfileVersion: '9.0'\npnpmfileChecksum: sha256-abc\n",
    });

    expect(status).not.toBe(0);
    expect(stderr).toMatch(
      /pnpm hook files \(\.pnpmfile\.cjs\) are not supported/,
    );
  });

  test('fails closed on an unparseable package.json', () => {
    const { status, stderr } = runInstaller({
      'package.json': '{ this is not json',
      'yarn.lock': '# yarn lockfile v1\n',
    });

    expect(status).not.toBe(0);
    expect(stderr).toMatch(/refusing to guess the package manager/);
    expect(stderr).not.toMatch(/SyntaxError/);
  });

  test('dev express major matches the cd wrapper (NHOST_EXPRESS_VERSION)', () => {
    const script = readFileSync(SCRIPT, 'utf8');
    const pinned = script.match(/^(?:export )?NHOST_EXPRESS_VERSION=(\S+)/m);
    expect(pinned).not.toBeNull();

    const declared = require('../package.json').devDependencies.express;
    const major = (v) => v.replace(/^\D*/, '').split('.')[0];
    expect(major(declared)).toBe(major(pinned[1]));
  });
});
