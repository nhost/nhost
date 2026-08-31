const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const SCRIPT = join(__dirname, '..', 'nhost-install-deps.sh');

// The shared install library is byte-identical to nhost/be's copy at
// services/cd/cmd/installscript/nhost-install-deps.sh, where the same hash is
// pinned. On an intentional edit: update this hash AND copy the file to the
// other repo so the two stay in sync.
const WANT_CHECKSUM =
  '0a9e06f35112542b53c3b7b0ea2bc4254d1534508e58733e894b51bd88e55fae';

describe('shared install library (parity with nhost/be services/cd)', () => {
  test('checksum is in sync with nhost/be', () => {
    const buf = readFileSync(SCRIPT);
    expect(createHash('sha256').update(buf).digest('hex')).toBe(WANT_CHECKSUM);
  });

  test('blocks install-time user code before any install or early return', () => {
    const script = readFileSync(SCRIPT, 'utf8');
    const exports = [
      'export npm_config_ignore_scripts=true',
      'export PNPM_CONFIG_IGNORE_SCRIPTS=true',
      'export PNPM_CONFIG_IGNORE_PNPMFILE=true',
      'export YARN_IGNORE_SCRIPTS=true',
      'export YARN_ENABLE_SCRIPTS=false',
      'export YARN_IGNORE_PATH=1',
      'export COREPACK_ENV_FILE=0',
      'export COREPACK_ENABLE_UNSAFE_CUSTOM_URLS=0',
    ];
    const boundaries = [
      ['first npm install', '\t\tnpm install '],
      ['corepack invocation', '\tcorepack enable --install-directory'],
      ['early no-manifest return', '\tif [ ! -f "$WORK_DIR/package.json" ]'],
      ['project install', '\t(cd "$WORK_DIR" && "$@")'],
    ];

    for (const exported of exports) {
      const exportIndex = script.indexOf(exported);
      expect({ exported, found: exportIndex !== -1 }).toEqual({
        exported,
        found: true,
      });

      for (const [name, marker] of boundaries) {
        const boundaryIndex = script.indexOf(marker);
        expect({ name, found: boundaryIndex !== -1 }).toEqual({
          name,
          found: true,
        });
        expect({
          exported,
          precedes: name,
          ok: exportIndex < boundaryIndex,
        }).toEqual({ exported, precedes: name, ok: true });
      }
    }
  });

  test('runs a frozen, workspace-isolated install for each manager', () => {
    const script = readFileSync(SCRIPT, 'utf8');

    for (const command of [
      'set -- npm ci --no-workspaces --ignore-scripts',
      'set -- pnpm install --frozen-lockfile --ignore-workspace --ignore-scripts --ignore-pnpmfile',
      'set -- yarn install --frozen-lockfile --ignore-scripts',
    ]) {
      expect({ command, found: script.includes(command) }).toEqual({
        command,
        found: true,
      });
    }

    expect(script).not.toContain('--immutable');

    expect(script.match(/npm ci --/)).not.toBeNull();
    expect(script).toMatch(/npm ci .*--ignore-scripts/);
    expect(script).toMatch(/pnpm install .*--ignore-scripts/);
    expect(script).toMatch(/yarn install .*--ignore-scripts/);
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
    expect(script).toContain('(detected via packageManager)');
    expect(script).toContain('(detected via yarn.lock)');
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
