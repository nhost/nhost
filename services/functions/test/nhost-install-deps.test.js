const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const SCRIPT = join(__dirname, '..', 'nhost-install-deps.sh');

// The shared install library is byte-identical to nhost/be's copy at
// services/cd/cmd/installscript/nhost-install-deps.sh, where the same hash is
// pinned. On an intentional edit: update this hash AND copy the file to the
// other repo so the two stay in sync.
const WANT_CHECKSUM =
  '62b2278e154adab2c05d6a7d29eb05eec44fdd43b5b4d357e1032305a8c373f7';

describe('shared install library (parity with nhost/be services/cd)', () => {
  test('checksum is in sync with nhost/be', () => {
    const buf = readFileSync(SCRIPT);
    expect(createHash('sha256').update(buf).digest('hex')).toBe(WANT_CHECKSUM);
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
