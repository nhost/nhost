const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const SCRIPT = join(__dirname, '..', 'nhost-install-deps.sh');

// The shared install library is byte-identical to nhost/be's copy at
// services/cd/cmd/installscript/nhost-install-deps.sh, where the same hash is
// pinned. On an intentional edit: update this hash AND copy the file to the
// other repo so the two stay in sync.
const WANT_CHECKSUM =
  'ba2449e5479dc519ae665f8e12acfe2ece34ea210fba4e8de291780469a4ba72';

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
