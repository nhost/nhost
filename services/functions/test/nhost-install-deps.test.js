const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const SCRIPT = join(__dirname, '..', 'nhost-install-deps.sh');

// The shared install library is byte-identical to nhost/be's copy at
// services/cd/cmd/installscript/nhost-install-deps.sh, where the same hash is
// pinned. On an intentional edit: update this hash AND copy the file to the
// other repo so the two stay in sync.
const WANT_CHECKSUM =
  '354d7aa50b5a9b15e551ce874dc59aae66c692173e2ea2f0854cac4c38045c05';

describe('shared install library (parity with nhost/be services/cd)', () => {
  test('checksum is in sync with nhost/be', () => {
    const buf = readFileSync(SCRIPT);
    expect(createHash('sha256').update(buf).digest('hex')).toBe(WANT_CHECKSUM);
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
    expect(script).toContain('Yarn 0 is not supported');
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
