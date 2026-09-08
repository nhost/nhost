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
  'e5bebbacf84ea72584812e2c906defff8a19b5a82bc307043761b864799c30f0';

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

  test('pins Yarn Classic when a parent manifest selects Berry', () => {
    const root = mkdtempSync(join(tmpdir(), 'nhost-yarn-'));
    try {
      const workDir = join(root, 'functions');
      mkdirSync(workDir);
      writeFileSync(
        join(root, 'package.json'),
        '{"packageManager":"yarn@4.9.1"}',
      );
      writeFileSync(join(workDir, 'package.json'), '{"name":"fn"}');
      writeFileSync(join(workDir, 'yarn.lock'), '# yarn lockfile v1\n');

      const output = execFileSync(
        'sh',
        [
          '-c',
          `
        . "$1"
        mkdir() { :; }
        corepack() {
          [ "$1" = enable ] && return 0
          printf '%s\\n' "$@" "$YARN_IGNORE_PATH"
        }
        yarn() { return 1; }
        nhost_install_deps
      `,
          'installer-test',
          SCRIPT,
        ],
        {
          cwd: workDir,
          env: { ...process.env, WORK_DIR: workDir },
          encoding: 'utf8',
          timeout: 5000,
        },
      );

      expect(output.trim().split('\n')).toEqual([
        'yarn@1.22.22+sha1.ac34549e6aa8e7ead463a7407e1c7390f61a6610',
        'install',
        '--frozen-lockfile',
        '--ignore-scripts',
        '1',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('dev express major matches the cd wrapper (NHOST_EXPRESS_VERSION)', () => {
    const script = readFileSync(SCRIPT, 'utf8');
    const pinned = script.match(/^NHOST_EXPRESS_VERSION=(\S+)/m);
    expect(pinned).not.toBeNull();

    const declared = require('../package.json').devDependencies.express;
    const major = (v) => v.replace(/^\D*/, '').split('.')[0];
    expect(major(declared)).toBe(major(pinned[1]));
  });
});
